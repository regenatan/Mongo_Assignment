// 1. SETUP EXPRESS
const express = require('express');
const cors = require('cors');
const { ObjectId } = require('mongodb');
const MongoClient = require('mongodb').MongoClient;
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const dbname = "cinemadb"; // CHANGED DATABASE NAME

// enable dotenv (allow Express application to read .env files)
require('dotenv').config();

// set the mongoUri to be MONGO_URI from the .env file
// make sure to read data from process.env AFTER `require('dotenv').config()`
const mongoUri = process.env.MONGO_URI;

// function to generate an access token
function generateAccessToken(id, email) {
    // set the payload of the JWT (i.e, developers can add any data they want)
    let payload = {
        'user_id': id,
        'email': email
    }

    // TODO: create the JWT
     let token = jwt.sign(payload, process.env.TOKEN_SECRET, {
        expiresIn: '1h' // you can adjust the expiry as needed (e.g. '7d', '1h', etc.)
    });

    return token;
}

// middleware: a function that executes before a route function
function verifyToken(req, res, next) {
    // get the JWT from the headers
    let authHeader = req.headers['authorization'];
    let token = null;
    if (authHeader) {
        // the token will be stored as in the header as:
        // BEARER <JWT TOKEN>
        token = authHeader.split(' ')[1];
        if (token) {
            // the callback function in the third parameter will be called after
            // the token has been verified
            jwt.verify(token, process.env.TOKEN_SECRET, function (err, payload) {
                if (err) {
                    console.error(err);
                    return res.sendStatus(403);
                }
                // save the payload into the request
                req.user = payload;
                // call the next middleware or the route function
                next();

            })
        } else {
            return res.sendStatus(403);
        }
    } else {
        return res.sendStatus(403);
    }
}

// 1a. create the app
const app = express();
app.use(cors()); // enable cross origin resources sharing

// 1b. enable JSON processing (i.e allow clients to send JSON data to our server)
app.use(express.json());
//app.use(express.urlencoded({ extended: false }));

// uri = connection string
async function connect(uri, dbname) {
const client = new MongoClient(uri);
    await client.connect();
    return client.db(dbname);
    // return db;
}

// 2. CREATE ROUTES
// All routes will be created in the `main` function
async function main() {

    // connect to the mongo database
    let db = await connect(mongoUri, dbname);

    app.get('/', function(req,res){
    res.json({
     "message":"Hello World!"
   });
})  

    app.get("/movies", async function (req, res) {
        try {
            // TODO: finish the code below to get all movies
            const movies = await db.collection("movies").find().project({
    title: 1,
    genre: 1,
    duration: 1,
    rating: 1
}).toArray();

res.json({ movies });


        } catch (error) {
            console.error("Error fetching movies:", error);
            res.status(500);
        }
    })
  
    app.get('/movies/search', async function (req, res) {
        try {

            // extract the search params
            let { title, genre, releaseYear, rating, cast, categories } = req.query;

            // create a filter object
            let query = {};

            
            if (title) {
                query.title = { $regex: title, $options: 'i' };
            }

            if (genre) {
                query['genre.name'] = new RegExp(genre, 'i');
            }

            if (releaseYear) {
                query.releaseYear = parseInt(releaseYear);
            }

            if (rating) {
                query.rating = { $gte: parseFloat(rating) };
            }

            if (cast) {
                query['cast.name'] = { $in: cast.split(',') };
            }

            if (categories) {
               query['categories.name'] = { $in: categories.split(',') };
            }

            // TODO: perform the search
             const results = await db.collection("movies").find(query).project({
            title: 1,
            genre: 1,
            duration: 1,
            releaseYear: 1,
            rating: 1,
            director: 1,
            'cast.name': 1,
            'categories.name': 1
        }).toArray();

            // send back the results
            res.json({
                'results': results
            })


        } catch (e) {
            console.error(e);
            res.status(500);
        }
    });

      app.get("/movies/:id", async function (req, res) {
        try {

            // get the id of the movie that we want to get full details off
            let id = req.params.id;

            // TODO: Write the code to find movie by its id
            const movie = await db.collection("movies").findOne(
            { _id: new ObjectId(id) },
            { projection: { _id: 0 } }
        );
        
        if (!movie) {
            return res.status(404).json({ error: "Movie not found" });
        }

            // send back a response
            res.json({
                'movie': movie
            })

        } catch (error) {
            console.error("Error fetching movie:", error);
            res.status(500);
        }
    });

    // we use app.post for HTTP METHOD POST - usually to add new data
    app.post("/movies", async function (req, res) {
        try {

            // title, genre, duration, releaseYear, rating, cast, reviews and categories
            // when we use POST, PATCH or PUT to send data to the server, the data are in req.body
            let { title, genre, duration, releaseYear, rating, cast, reviews, categories } = req.body;

            // basic validation: make sure that title, genre, cast, reviews and categories
            if (!title || !genre || !cast || !reviews || !categories) {
                return res.status(400).json({
                    "error": "Missing fields required"
                })
            }

            // find the _id of the related genre and add it to the new movie
            let genreDoc = await db.collection('genres').findOne({
                "name": genre
            })

            if (!genreDoc) {
                return res.status(400).json({ "error": "Invalid genre" })
            }

            // find all the categories that the client want to attach to the movie document
            const categoryDocuments = await db.collection('categories').find({
                'name': {
                    '$in': categories
                }
            }).toArray();

            // TODO: create a new movie document
            let newMovieDocument = {
    title: title,
    genre: genreDoc, // embed the full genre document
    duration: duration,
    releaseYear: releaseYear,
    rating: rating,
    cast: cast,
    reviews: reviews.map(review => ({
        ...review,
        date: new Date(review.date) // convert string to Date object
    })),
    categories: categoryDocuments // embed the full category documents
};

            //insert the new movie document into the collection
            let result = await db.collection("movies").insertOne(newMovieDocument);

            res.status(201).json({
                'message': 'New movie has been created',
                'movieId': result.insertedId // insertedId is the _id of the new document
            })


        } catch (e) {
            console.error(e);
            res.status(500);
        }
    })

    app.put("/movies/:id", async function (req, res) {
        try {

            let id = req.params.id;

            let { title, genre, duration, releaseYear, rating, cast, reviews, categories } = req.body;

            // basic validation: make sure that title, genre, cast, reviews and categories
            if (!title || !genre || !cast || !reviews || !categories) {
                return res.status(400).json({
                    "error": "Missing fields required"
                })
            }

            // find the _id of the related genre and add it to the new movie
            let genreDoc = await db.collection('genres').findOne({
                "name": genre
            })

            if (!genreDoc) {
                return res.status(400).json({ "error": "Invalid genre" })
            }

            // find all the categories that the client want to attach to the movie document
            const categoryDocuments = await db.collection('categories').find({
                'name': {
                    '$in': categories
                }
            }).toArray();

            // TODO: create a new movie document based on the provided data
            let updatedMovieDocument = {
            title: title,
            genre: genreDoc,
            duration: duration,
            releaseYear: releaseYear,
            rating: rating,
            cast: cast,
            reviews: reviews.map(review => ({
                ...review,
                date: new Date(review.date)
            })),
            categories: categoryDocuments
        };

            // TODO: update the movie document
            let result = await db.collection("movies").updateOne(
            { _id: new ObjectId(id) },
            { $set: updatedMovieDocument }
        );

            // if there is no matches, means no update took place
            if (result.matchedCount == 0) {
                return res.status(404).json({
                    "error": "Movie not found"
                })
            }

            res.status(200).json({
                "message": "Movie updated"
            })


        } catch (e) {
            console.error(e);
            res.status(500);
        }
    })

    app.delete("/movies/:id", async function (req, res) {
        try {
            let id = req.params.id;

            // TODO:  delete the movie by its id
            const results = await db.collection('movies').deleteOne({ _id: new ObjectId(id) });

            if (results.deletedCount == 0) {
                return res.status(404).json({
                    "error": "Movie not found"
                });
            }

            res.json({
                "message": "Movie has been deleted successfully"
            })

        } catch (e) {
            console.error(e);
            res.status(500);
        }
    })

    // route for user to sign up
    // the user must provide an email and password
    app.post('/users', async function (req, res) {
        try {
            console.log(req.body)
            let { email, password, role } = req.body;
            if (!email || !password) {
                return res.status(400).json({
                    "error": "Please provide user name and password"
                })
            }

            const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
            return res.status(400).json({ error: 'Email already in use' });
        }

        // Hash the password
        const hashedPassword = await bcrypt.hash(password, 12);

            // TODO: create the new user document
            let userDocument = {
               email: email,
            password: hashedPassword,
            role: role
            };

            // TODO: Insert the new user document into the collection
            let result = await db.collection('users').insertOne(userDocument);
            res.json({
                "message": "New user account has been created",
                result
            })

        } catch (e) {
            console.error(e);
            res.status(500);
        }
    })


    // the client is supposed to provide the email and password in req.body
    app.post('/login', async function (req, res) {
        try {
                console.log(req.body)
            let { email, password } = req.body;
           
            if (!email || !password) {
                return res.status(400).json({
                    'message': 'Please provide email and password'
                })
            }

            // TODO: find the user by their email
            let user = await db.collection('users').findOne({ email: email });
            console.log(user);
            // if the user exists
            if (user) {
                // check the password (compare plaintext with the hashed one in the database)
                if (bcrypt.compareSync(password, user.password)) {
                    console.log("password corect")
                    // TODO: create the accessToken
                    const accessToken = generateAccessToken(user._id, user.email);

                    res.json({
                        "accessToken": accessToken
                    })
                } else {
                    res.sendStatus(401);
                }
            } else {
                res.sendStatus(401);
            }

        } catch (e) {
            console.error(e);
            res.sendStatus(500);
        }
    })

    app.get('/user', verifyToken, async function (req, res) {

        // get the payload
        let user = req.user;

        res.json({
            user
        })

    })

 app.get('/users', verifyToken, async function (req, res) {
    try {
        if (req.user.role !== 'admin') {
            return res.status(403).json({ message: 'Forbidden: Admins only' });
        }
          const users = await db.collection("users").find().project({
    email: 1,
    role: 1,
}).toArray();

res.json({ users});
        //let users = await User.find().select('-password');
        // res.json({ users });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error' });
    }
});

}
main();


// 3. START SERVER (Don't put any routes after this line)
app.listen(4000, function () {
    console.log("Server has started.");
})