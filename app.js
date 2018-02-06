const app = require('express')();
const MongoClient = require('mongodb').MongoClient;

MongoClient.connect('mongodb://localhost:27017/moma', (err, db) => {
  if (err) throw err;
  app
    .get('/', (req, res) => {
      db
        .collection('Artworks')
        .aggregate(
          [{ $match: { URL: { $ne: null } } }, { $sample: { size: 1 } }],
          (err, result) => {
            res.send(result[0].URL);
          }
        );
    })
    .listen(3000, () => {
      console.log(`app listening on localhost:3000`);
    });
});
