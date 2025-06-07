// import-data.js
const { MongoClient } = require('mongodb');
const fs = require('fs');
require('dotenv').config();

// MongoDB connection URI from .env file
const mongoUri = process.env.MONGO_URI;
const dbName = "cinemadb";

async function importData() {
  try {
    // Connect to MongoDB
    const client = await MongoClient.connect(mongoUri, {
      useUnifiedTopology: true
    });
    
    const db = client.db(dbName);
    console.log(`Connected to database: ${dbName}`);

    // Read JSON files
    const genres = JSON.parse(fs.readFileSync('./sample_data/genres.json', 'utf8'));
    const categories = JSON.parse(fs.readFileSync('./sample_data/categories.json', 'utf8'));
    const users = JSON.parse(fs.readFileSync('./sample_data/users.json', 'utf8'));
    const movies = JSON.parse(fs.readFileSync('./sample_data/movies.json', 'utf8'));

    // Convert string ObjectIds to MongoDB ObjectIds
    function prepareDocuments(documents) {
      return documents.map(doc => {
        // Convert root _id
        if (doc._id && doc._id.$oid) {
          doc._id = new require('mongodb').ObjectId(doc._id.$oid);
        }
        
        // Handle dates
        Object.keys(doc).forEach(key => {
          if (doc[key] && doc[key].$date) {
            doc[key] = new Date(doc[key].$date);
          }
        });

        // Handle nested documents (for movies collection)
        if (doc.genre && doc.genre._id && doc.genre._id.$oid) {
          doc.genre._id = new require('mongodb').ObjectId(doc.genre._id.$oid);
        }
        
        if (doc.categories) {
          doc.categories = doc.categories.map(category => {
            if (category._id && category._id.$oid) {
              category._id = new require('mongodb').ObjectId(category._id.$oid);
            }
            return category;
          });
        }
        
        if (doc.reviews) {
          doc.reviews = doc.reviews.map(review => {
            if (review.date && review.date.$date) {
              review.date = new Date(review.date.$date);
            }
            return review;
          });
        }
        
        return doc;
      });
    }

    // Drop existing collections (optional - for clean imports)
    await db.collection('genres').drop().catch(() => console.log('Genres collection does not exist yet - creating new'));
    await db.collection('categories').drop().catch(() => console.log('Categories collection does not exist yet - creating new'));
    await db.collection('users').drop().catch(() => console.log('Users collection does not exist yet - creating new'));
    await db.collection('movies').drop().catch(() => console.log('Movies collection does not exist yet - creating new'));

    // Insert data
    const genresResult = await db.collection('genres').insertMany(prepareDocuments(genres));
    console.log(`${genresResult.insertedCount} genres inserted`);
    
    const categoriesResult = await db.collection('categories').insertMany(prepareDocuments(categories));
    console.log(`${categoriesResult.insertedCount} categories inserted`);
    
    const usersResult = await db.collection('users').insertMany(prepareDocuments(users));
    console.log(`${usersResult.insertedCount} users inserted`);
    
    const moviesResult = await db.collection('movies').insertMany(prepareDocuments(movies));
    console.log(`${moviesResult.insertedCount} movies inserted`);

    console.log('All data imported successfully');
    
    await client.close();
    console.log('Database connection closed');
    
  } catch (error) {
    console.error('Error importing data:', error);
  }
}

importData();