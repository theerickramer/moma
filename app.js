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
const redisSubscriber = redis.createClient();
const redisPublisher = redis.createClient();
redisSubscriber.subscribe('jobCompletion');

// JOB QUEUES
const getImageDataQueue = new Queue('getImageData', process.env.REDIS_URL);
const getHiResQueue = new Queue('getHiRes', process.env.REDIS_URL);

getImageDataQueue.process(() => getImage());
getImageDataQueue.on('completed', (job, result) => {
  const { url } = JSON.parse(result);
  const message = {
    type: 'imageData',
    result
  };
  getHiResQueue.add({ url });
  redisPublisher.publish('jobCompletion', JSON.stringify(message));
});

getHiResQueue.process(job => getHiRes(job.data.url));
getHiResQueue.on('completed', (job, result) => {
  const message = {
    type: 'hiRes',
    result
  };
  redisPublisher.publish('jobCompletion', JSON.stringify(message));
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
      } else {
        tries++;
      }
    }, 250);
  };
};

wss.on('connection', async ws => {
  const job = await getImageDataQueue.add();

  redisSubscriber.on('message', (channel, message) => {
    const parsed = JSON.parse(message);
    ws.send(parsed.result);

    if (parsed.type === 'hiRes') {
      ws.terminate();
      // clearInterval(interval);
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

getHiRes = url => {
  return new Promise((resolve, reject) => {
    return axios.get(url).then(response => {
      console.log('moma scraped');
      asset =
        'https://moma.org' +
        $('img.picture__img--focusable', response.data).attr('src');
      resolve(JSON.stringify({ src: asset }));
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
