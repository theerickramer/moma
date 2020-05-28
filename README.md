# RandoMOMA
Random images from MOMA

I love Chrome extensions that load artwork when you open a new tab. The Museum of Modern Art does not have such an extension. They do, however, have a massive JSON file of artists and artworks available on Github. Since I wanted to see modern art, I decided to build my own little app using this JSON. It was a challenge dealing with the large dataset. Initially I wanted to try a static site generator called Gatsby so I could use their graphQL interface, but it couldn't handle JSON of that size. Next I decided to switch to a simple Express server using MongoDB. After I successfully seeded Mongo with the data, I created a query to return a random record if it contains an image URL. This image, however, is only a low resolution thumbnail. It renders on the page extremely pixelated. To remedy this, I fine tuned my Mongo query to only return records which also have an artwork page URL on moma.com. With this URL, I make a request to moma.com and scrape the resulting page with Cheerio, a JS library that allows jQuery like parsing of HTML strings, retrieve the full resolution image, and replace the blurred thumbnail, which creates a lazy-loading like effect.

For the first draft, I used vanilla javascript to quickly create a high resolution image replacement. I have since replaced the layout with VueJS and am utilizing its lifecycle methods and computed values.

This project lives in demo form on Heroku at the moment. Using the free tier, the server goes into a deep sleep when not in use and is extremely sluggish to wake. This resulted in an application time out error due to Heroku's 30 sec limit on web requests. To remedy this, I implemented worker processes using Bull process queing, with web sockets to ping the client every 29 seconds, in case the server is still sleepy.

Finally, I had to create a Redis publisher / subcriber messaging system to signal when worker processes are completed. 

So the whole process goes like this:
- client loads page with an empty Vue instance and loading spinner.
- Vue 'mounted' method opens a web socket connection with server.
- Server kicks off a worker process in Bull to retrieve a database record
- When the process is complete, web socket sends data to client. If 29 seconds passes with no response from DB, web socket pings client to avoid timeout error.
- The moma.org URL of the artwork is sent to another worker process
- Worker makes an AJAX request for the MOMA page, parses the HTML and retrieves the high resolution image source.
- The high resolution image link is sent to client. If 29 seconds passes with no response from this worker, web socket pings client to avoid timeout error.
- Vue receives the image source, replaces the thumbnail with it, and rerenders.

Voilà, a totally over engineered solution to a seemingly simple problem!
