const $ = require('cheerio');
const axios = require('axios');
const bodyParser = require('body-parser');
const Queue = require('bull');
const Websocket = require('ws');
const express = require('express');
const app = express();
const http = require('http');
const server = http.createServer(app);
const WebSocketServer = require('ws').Server;
const wss = new WebSocketServer({ server, path: '/socket' });
const MongoClient = require('mongodb').MongoClient;
let mongo;

connectMongo = () => {
  mongo = MongoClient.connect(process.env.MONGODB_URI).catch(err =>
    console.error(err)
  );
  console.log('mongo connected');
};

connectMongo();

getImage = (req, res, next) => {
  if (mongo) {
    mongo
      .then(db => db.collection('Artworks'))
      .then(collection => {
        let image;
        collection.aggregate(
          [
            {
              $match: {
                URL: { $ne: null },
                ThumbnailURL: { $exists: true, $ne: null }
              }
            },
            { $sample: { size: 1 } }
          ],
          (err, result) => {
            if (err) reject(new Error(err));
            console.log('mongo queried');
            const title = result[0]['Title'];
            const artist =
              result[0]['Artist'].length > 1
                ? result[0]['Artist'].join(', ')
                : result[0]['Artist'];
            const date = result[0]['Date'];
            const medium = result[0]['Medium'];
            const url = result[0]['URL'];
            const thumb = result[0]['ThumbnailURL'];
            res.locals.image = { title, artist, date, medium, url, thumb };
            next();
          }
        );
      });
  }
};

sendImage = (req, res, next) => {
  try {
    const { title, artist, date, medium, thumb, url } = res.locals.image;
    res.render('index', { title, artist, date, medium, thumb, url });
  } catch (error) {
    res.send(`Something's wrong...`);
  }
  next();
};

getHiRes = url => {
  return new Promise((resolve, reject) => {
    return axios.get(url).then(response => {
      console.log('moma scraped');
      asset =
        'https://moma.org' +
        $('img.picture__img--focusable', response.data).attr('src');
      resolve(asset);
    });
  });
};

const getHiResQueue = new Queue('getHiRes', 'redis://127.0.0.1:6379');
const hiResQueue = new Queue('hiRes', 'redis://127.0.0.1:6379');

getHiResQueue.process(job => {
  return getHiRes(job.data.url);
});

hiResQueue.process((job, done) => {
  done(job.data.result);
});

hiResQueue.on('completed', function(job, result) {
  console.log(`COMPLETED: ${job.id} RESULT: ${result}`);
});

getHiResQueue.on('completed', function(job, result) {
  console.log(`COMPLETED: ${result}`);
  hiResQueue.add({ jobId: job.id, result });
});

app
  .set('view engine', 'ejs')
  .use(express.static('public'))
  .use(bodyParser.json())
  .get('/', getImage, sendImage)
  .post('/gethi', async (req, res) => {
    const job = await getHiResQueue.add({ url: req.body.url });
    res.json({ jobId: job.id });
  });

server.listen(process.env.PORT || 3000, () => {
  console.log(`app listening on localhost:3000`);
});

wss.on('connection', ws => {
  const findJobResult = async id => {
    const jobs = await hiResQueue.getJobs();
    return jobs.forEach(job => {
      if (job.data.jobId === id) {
        console.log(`findJobResult: ${job.data}`);
        return job.data;
      }
    });
  };

  ws.on('message', async jobId => {
    const interval = setInterval(async () => {
      const result = await findJobResult(jobId);
      if (result) {
        console.log('result: ' + result);
        // ws.send(result);
        clearInterval(interval);
      }
    }, 100);
  });
});
