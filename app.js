const express = require('express');
const app = express();
const axios = require('axios');
const $ = require('cheerio');
const MongoClient = require('mongodb').MongoClient;
let mongo;

connectMongo = () => {
  mongo = MongoClient.connect(process.env.MONGODB_URI).catch(err =>
    console.error(err)
  );
  console.log('mongo connected');
};

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

getHiRes = (req, res, next) => {
  axios.get(res.locals.image.url).then(response => {
    console.log('moma scraped');
    res.locals.image.src =
      'https://moma.org' +
      $('img.picture__img--focusable', response.data).attr('src');
    next();
  });
};

sendImage = (req, res, next) => {
  try {
    const { title, artist, date, medium, src, thumb } = res.locals.image;
    res.render('index', { title, artist, date, medium, src, thumb });
  } catch (error) {
    res.send(`Something's wrong...`);
  }
  next()
};

connectMongo();

app
  .set('view engine', 'ejs')
  .use(express.static('public'))
  .get('/', getImage, getHiRes, sendImage)
  .listen(process.env.PORT || 3000, () => {
    console.log(`app listening on localhost:3000`);
  });
