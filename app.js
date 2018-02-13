const app = require('express')();
const axios = require('axios');
const $ = require('cheerio');
const MongoClient = require('mongodb').MongoClient;
app.set('view engine', 'ejs');

MongoClient.connect('mongodb://localhost:27017/moma', (err, db) => {
  if (err) throw err;
  app
    .get('/', (req, res) => {
      db
        .collection('Artworks')
        .aggregate(
          [{ $match: { URL: { $ne: null } } }, { $sample: { size: 1 } }],
          (err, result) => {
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
              res.render('index', { title, artist, date, medium, src, thumb });
            });
          }
        );
    })
    .listen(3000, () => {
      console.log(`app listening on localhost:3000`);
    });
});
