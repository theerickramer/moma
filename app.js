const app = require('express')();
const axios = require('axios');
const $ = require('cheerio');
const MongoClient = require('mongodb').MongoClient;
let mongo;

connectMongo = () => {
  mongo = MongoClient.connect(process.env.MONGODB_URI).catch(err =>
    console.error(err)
  );
  console.log('mongo connected')
}

getImage = () => {
  if (mongo) {
    return new Promise((resolve, reject) => {
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
              let src;
              const title = result[0]['Title'];
              const artist =
                result[0]['Artist'].length > 1
                  ? result[0]['Artist'].join(', ')
                  : result[0]['Artist'];
              const date = result[0]['Date'];
              const medium = result[0]['Medium'];
              const url = result[0]['URL'];
              const thumb = result[0]['ThumbnailURL'];
              axios.get(url).then(response => {
                console.log('moma scraped')
                src =
                  'https://moma.org' +
                  $('img.picture__img--focusable', response.data).attr('src');
                image = { title, artist, date, medium, src, thumb };
                resolve(image);
              });
            }
          );
        });
    });
  } else {
    connectMongo();
    return getImage();
  }
};

connectMongo();

app
  .set('view engine', 'ejs')
  .get('/', async (req, res) => {
    try {
      const { title, artist, date, medium, src, thumb } = await getImage();
      res.render('index', { title, artist, date, medium, src, thumb });
    } catch (error) {
      res.send(`Something's wrong...`);
    }
  })
  .listen(process.env.PORT || 3000, () => {
    console.log(`app listening on localhost:3000`);
  });
