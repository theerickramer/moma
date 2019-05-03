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
const getImageDataQueue = new Queue('getImageData', process.env.REDIS_URL);
const getHiResQueue = new Queue('getHiRes', process.env.REDIS_URL);

getImageDataQueue.process(() => getImage());

getHiResQueue.process(job => getHiRes(job.data.url));

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
  ws.on('message', async messageJson => {
    const message = JSON.parse(messageJson);
      console.log(message)

    if (message.request === 'imageData') {
      const job = await getImageDataQueue.add();
      const imageDataPoll = createQueuePoll(getImageDataQueue, job.id, ws);
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
                  : result[0]['Artist'];
              const job = await getHiResQueue.add({ url });

              const imageData = {
                title,
                artist,
                date,
                medium,
                src,
                url,
                jobId: job.id
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
      resolve(asset);
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
