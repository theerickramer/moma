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
const redis = require('redis');

// REDIS
const redisSubscriber = redis.createClient(process.env.REDIS_URL);
const redisPublisher = redis.createClient(process.env.REDIS_URL);
redisSubscriber.subscribe('jobCompleted');

// JOB QUEUES
const getImageDataQueue = new Queue('getImageData', process.env.REDIS_URL);
const getHiResQueue = new Queue('getHiRes', process.env.REDIS_URL);

getImageDataQueue.process(() => getImage());
getImageDataQueue.on('completed', (job, result) => {
  const { url, ...imgData } = JSON.parse(result);
  const message = {
    type: 'imageData',
    jobId: job.id,
    data: { ...imgData, url }
  };
  getHiResQueue.add({ url, jobId: job.id });
  redisPublisher.publish('jobCompleted', JSON.stringify(message));
});

getHiResQueue.process(job => {
  const { url, jobId } = job.data;
  return getHiRes(url, jobId);
});
getHiResQueue.on('completed', (job, result) => {
  const { jobId, ...imgUrl } = JSON.parse(result);
  const message = {
    type: 'hiRes',
    jobId,
    data: imgUrl
  };
  redisPublisher.publish('jobCompleted', JSON.stringify(message));
});

// WEB SOCKET
const wss = new WebSocketServer({ server, path: '/socket' });

wss.on('connection', async ws => {
  const job = await getImageDataQueue.add();
  const interval = setInterval(() => {
    ws.ping('working...');
  }, 29000);

  redisSubscriber.on('message', (channel, message) => {
    const { jobId, data, type } = JSON.parse(message);

    if (jobId === job.id) {
      ws.send(JSON.stringify(data));
    }

    if (type === 'hiRes') {
      ws.terminate();
      clearInterval(interval);
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
getImage = () => {
  return new Promise((resolve, reject) => {
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
              console.log(result)
              const {
                Title: title,
                Date: date,
                Medium: medium,
                ThumbnailURL: src,
                URL: url
              } = result[0];
              const artist =
                result[0]['Artist'].length > 1
                  ? result[0]['Artist'].join(', ')
                  : result[0]['Artist'][0];

              const imageData = {
                title,
                artist,
                date,
                medium,
                src,
                url
              };

              resolve(JSON.stringify(imageData));
            }
          );
        });
    }
  });
};

getHiRes = (url, jobId) => {
  return new Promise((resolve, reject) => {
    return axios.get(url).then(response => {
      console.log('moma scraped');
      asset =
        'https://moma.org' +
        $('source[media="(max-width: 1999px)"]', response.data).attr('srcset').split(' ')[0];
      console.log(asset)
      resolve(JSON.stringify({ src: asset, jobId }));
    });
  });
};

// SERVER
app
  .set('view engine', 'ejs')
  .use(express.static('public'))
  .use(bodyParser.json())
  .get('/', (req, res) => {
    res.render('index');
  });

server.listen(process.env.PORT || 3000, () => {
  console.log(`app listening on localhost:3000`);
});
