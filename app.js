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
            axios.get(result[0].URL).then(response => {
              let src =
                'http://moma.org' +
                $('img.picture__img--work', response.data).attr('src');
              res.render('index', { src });
            });
          }
        );
    })
    .listen(3000, () => {
      console.log(`app listening on localhost:3000`);
    });
});
