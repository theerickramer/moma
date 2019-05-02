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

// JOB QUEUES
const getHiResQueue = new Queue('getHiRes', process.env.REDIS_URL);

getHiResQueue.process(job => {
  return getHiRes(job.data.URL);
});

const getImageDataQueue = new Queue('getImageData', process.env.REDIS_URL);

getImageDataQueue.process(job => {
  // return getHiRes(job.data.URL);
});

// WEB SOCKET
const wss = new WebSocketServer({ server, path: '/socket' });

const createQueuePoll = (queue, jobId, socket) => {
  return () => {
    let tries = 0;
    const interval = setInterval(async () => {
      const { returnvalue } = await queue.getJob(jobId);
      if (tries % 100 === 0) {
        socket.ping('still trying...');
      }
      console.log(returnvalue);
      if (returnvalue) {
        socket.send(returnvalue);
        socket.terminate();
        clearInterval(interval);
      } else {
        tries++;
      }
    }, 250);
  };
};

wss.on('connection', ws => {
  ws.on('message', messageJson => {
    const message = JSON.parse(messageJson);

    if (message.request === 'imageData') {
      const imageDataPoll = createQueuePoll(
        getImageDataQueue,
        message.jobId,
        ws
      );
      imageDataPoll();
    } else if (message.request === 'hiRes') {
      const hiResPoll = createQueuePoll(getHiResQueue, message.jobId, ws);
      hiResPoll();
    }
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

// SERVER
app
  .set('view engine', 'ejs')
  .use(express.static('public'))
  .use(bodyParser.json())
  .get('/', getImage, sendImage);

server.listen(process.env.PORT || 3000, () => {
  console.log(`app listening on localhost:3000`);
});
