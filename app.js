const app = require('express')();
const axios = require('axios');
const $ = require('cheerio');
const MongoClient = require('mongodb').MongoClient;
let mongo;

getImage = () => {
  if (mongo) {
    return new Promise((resolve, reject) => {
      mongo.then(db => db.collection('Artworks')).then(collection => {
        let image;
        collection.aggregate(
          [
            { $match: { URL: { $ne: null }, ThumbnailURL: { $exists: true, $ne: null } } },
            { $sample: { size: 1 } }
          ],
          (err, result) => {
            if (err) reject(new Error(err));
            let src;
            const title = result[0]['Title'];
            const artist = result[0]['Artist'].toString();
            const date = result[0]['Date'];
            const medium = result[0]['Medium'];
            const url = result[0]['URL'];
            const thumb = result[0]['ThumbnailURL'];
            axios.get(url).then(response => {
              src =
                'http://moma.org' +
                $('img.picture__img--work', response.data).attr('src');
              image = { title, artist, date, medium, src, thumb };
              resolve(image);
            });
          }
        );
      });
    });
  } else {
    mongo = MongoClient.connect('mongodb://localhost:27017/moma').catch(err =>
      console.error(err)
    );
    return getImage();
  }
};

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
  .listen(3000, () => {
    console.log(`app listening on localhost:3000`);
  });
