# Demo Project

## Without Asset Management

Use [foreman](https://npmjs.org/package/foreman) to run the application as-is.

    $ nf start
    [OKAY] Loaded ENV .env File as KEY=VALUE Format
    [OKAY] Trimming display Output to 97 Columns
    13:04:27 web.1 |  [WARN] No Assets File Found (assets.json)
    13:04:27 web.1 |  Express Server Listening on Port: 5000

Since there is no assets file, Rude will pass assets through un-changed.

## With Asset Management

The above configuration required us to keep our image asset in Git.
We would rather not.

First we must track the image asset:

    $ rude add public/momo.png
    Asset Added: momo.png

Run the express application again:

    $ nf start
    [OKAY] Loaded ENV .env File as KEY=VALUE Format
    [OKAY] Trimming display Output to 97 Columns
    13:08:42 web.1 |  Express Server Listening on Port: 5000

Check out http://localhost:5000`, and view the page source.
You can see the asset is now being served from the local CouchDB database.

There is no need to keep your image in Git anymore:

    $ git rm public/momo.png

