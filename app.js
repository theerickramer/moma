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
const MongoClient = require('mongodb').MongoClient;

// WEB SOCKET
const wss = new WebSocketServer({ server, path: '/socket' });

wss.on('connection', ws => {
  ws.on('message', jobId => {
    const interval = setInterval(async () => {
      const { returnvalue } = await getHiResQueue.getJob(jobId);
      if (returnvalue) {
        ws.send(returnvalue);
        clearInterval(interval);
      }
    }, 100);
  });
});

// MONGO
let mongo;
connectMongo = () => {
  mongo = MongoClient.connect(process.env.MONGODB_URI).catch(err =>
    console.error(err)
  );
  console.log('mongo connected');
};

connectMongo();

// FUNCTIONS
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
          async (err, result) => {
            if (err) reject(new Error(err));
            console.log('mongo queried');
            const { Title, Date, Medium, ThumbnailURL, URL } = result[0];
            const Artist =
              result[0]['Artist'].length > 1
                ? result[0]['Artist'].join(', ')
                : result[0]['Artist'];
            const job = await getHiResQueue.add({ URL });

            res.locals.image = {
              Title,
              Artist,
              Date,
              Medium,
              ThumbnailURL,
              URL,
              jobId: job.id
            };

            next();
          }
        );
      });
  }
};

sendImage = (req, res, next) => {
  try {
    res.render('index', { ...res.locals.image });
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

// JOB QUEUE
const getHiResQueue = new Queue('getHiRes', 'redis://127.0.0.1:6379');

getHiResQueue.process(job => {
  return getHiRes(job.data.URL);
});

// SERVER
app
  .set('view engine', 'ejs')
  .use(express.static('public'))
  .use(bodyParser.json())
  .get('/', getImage, sendImage);

server.listen(process.env.PORT || 3000, () => {
  console.log(`app listening on localhost:3000`);
});
