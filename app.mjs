import cheerio from "cheerio";
import axios from "axios";
import bodyParser from "body-parser";
import Queue from "bull";
import express from "express";
const app = express();
import http from "http";
const server = http.createServer(app);
import { WebSocketServer } from "ws";
import redis from "redis";
import { MongoClient, ServerApiVersion } from "mongodb";

// REDIS
const redisSubscriber = redis.createClient({ url: process.env.REDIS_URL });
const redisPublisher = redis.createClient({ url: process.env.REDIS_URL });
const onRedisError = err => console.error(err);
redisSubscriber.on("error", onRedisError);
redisPublisher.on("error", onRedisError);
await redisPublisher.connect();
await redisSubscriber.connect();

// JOB QUEUES
const getImageDataQueue = new Queue("getImageData", {
  redis: {
    port: process.env.REDIS_PORT,
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD
  }
});
const getHiResQueue = new Queue("getHiRes", {
  redis: {
    port: process.env.REDIS_PORT,
    host: process.env.REDIS_HOST,
    password: process.env.REDIS_PASSWORD
  }
});

getImageDataQueue.process(() => getImage());
getImageDataQueue.on("completed", async (job, result) => {
  const { url, ...imgData } = JSON.parse(result);
  const message = {
    type: "imageData",
    jobId: job.id,
    data: { ...imgData, url }
  };
  getHiResQueue.add({ url, jobId: job.id });
  redisPublisher.publish("jobCompleted", JSON.stringify(message));
});

getHiResQueue.process(job => {
  const { url, jobId } = job.data;
  return getHiRes(url, jobId);
});
getHiResQueue.on("completed", async (_job, result) => {
  const { jobId, ...imgUrl } = JSON.parse(result);
  const message = {
    type: "hiRes",
    jobId,
    data: imgUrl
  };
  redisPublisher.publish("jobCompleted", JSON.stringify(message));
});

// WEB SOCKET
const wss = new WebSocketServer({ server, path: "/socket" });

wss.on("connection", async ws => {
  const job = await getImageDataQueue.add();
  const interval = setInterval(() => {
    ws.ping("working...");
  }, 29000);
  console.log("ws connected");
  redisSubscriber.subscribe("jobCompleted", message => {
    const { jobId, data, type } = JSON.parse(message);

    if (jobId === job.id) {
      ws.send(JSON.stringify(data));
    }

    if (type === "hiRes") {
      ws.terminate();
      clearInterval(interval);
    }
  });
});

// MONGO
let mongo;
const connectMongo = () => {
  mongo = new MongoClient(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverApi: ServerApiVersion.v1
  });

  console.log("mongo connected");
};

connectMongo();

// FUNCTIONS
const getImage = () => {
  return new Promise((resolve, _reject) => {
    if (mongo) {
      mongo.connect(async _err => {
        const collection = await mongo
          .db("heroku_5bj44w4g")
          .collection("Artworks");
        const result = await collection
          .aggregate([
            {
              $match: {
                URL: { $ne: null },
                ThumbnailURL: { $exists: true, $ne: null }
              }
            },
            { $sample: { size: 1 } }
          ])
          .toArray();
        console.log("mongo queried");
        const {
          Title: title,
          Date: date,
          Medium: medium,
          ThumbnailURL: src,
          URL: url
        } = result[0];
        const artist =
          result[0]["Artist"].length > 1
            ? result[0]["Artist"].join(", ")
            : result[0]["Artist"][0];

        const imageData = {
          title,
          artist,
          date,
          medium,
          src,
          url
        };

        resolve(JSON.stringify(imageData));
      });
    }
  });
};

const getHiRes = (url, jobId) => {
  return new Promise((resolve, _reject) => {
    return axios.get(url).then(response => {
      console.log("moma scraped");
      const $ = cheerio.load(response.data);
      const asset =
        "https://moma.org" +
        $("img")
          .attr("src")
          .split("?")[0];
      console.log(asset);
      resolve(JSON.stringify({ src: asset, jobId }));
    });
  });
};

// SERVER
app
  .set("view engine", "ejs")
  .use(express.static("public"))
  .use(bodyParser.json())
  .get("/", (req, res) => {
    res.render("index");
  });

server.listen(process.env.PORT || 3000, () => {
  console.log(`app listening on localhost:3000`);
});
