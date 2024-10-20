// Import necessary libraries for the project:
import axios from "axios";
import bodyParser from "body-parser";
import bcrypt from "bcrypt"; // NEW
import { config } from "dotenv";
import express from "express";
import passport from "passport"; // NEW
import pg from "pg";
import session from "express-session"; // NEW
import { Strategy as LocalStrategy } from "passport-local"; // NEW
import { Strategy as GoogleStrategy } from "passport-google-oauth20"; // NEW

// Import local modules:
import * as utilFunc from "./utilityFunctions.js";

// Create an instance of an Express application:
const app = express();
// Define the port number on which the server will listen for requests:
const serverPort = 3000;
// Define number of salt rounds for use in encryption/decryption:
const saltRounds = 10; // NEW

config();

// NEW
app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 1000 * 60 * 60 * 24 },
    })
);

// Enable parsing of URL-encoded data from incoming requests:
app.use(bodyParser.urlencoded({ extended: true }));
// Serve static files (CSS, images, etc.) from the "public" directory:
app.use(express.static("public"));

app.use(passport.initialize()); // NEW
app.use(passport.session()); // NEW

// Configure connection to PostgreSQL database managed by pgAdmin 4:
const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Establish a connection to the PostgreSQL database:
db.connect().catch((err) => {
    console.error("Failed to connect to the database:", err);
    process.exit(1);
});

// // * * * * * * ** * * * * * * //
// // * * * BOOK FUNCTIONS * * * //
// // * * * * * * ** * * * * * * //
// /**
//  * Formats a user-provided title string by removing spaces,
//  * converting to lowercase, and joining words with the '+' character.
//  * This formatted string is suitable for use in URLs.
//  *
//  * @param {string} titleString - The user input string representing a book title.
//  * @returns {string} The formatted search string.
//  * @example
//  * // Returns the+sun+also+rises
//  * toSearchString("The Sun Also Rises");
//  */
// function toSearchString(titleString) {
//     try {
//         return titleString.trim().toLowerCase().split(" ").join("+");
//     } catch (error) {
//         console.error("Error in toSearchString function:", error);
//         // Return empty string on error to prevent undefined behavior:
//         return "";
//     }
// }

// /**
//  * Fetches book data from the Open Library API using the provided URL.
//  * Returns an object containing the book's title, author, and ISBN number.
//  *
//  * @param {string} url - The URL to query the Open Library API.
//  * @returns {object} An object containing the book's title, author, and ISBN.
//  * @example
//  * // Returns { title: The Sun Also Rises, author: Ernest Hemingway, isbn: "0330105515" }
//  * getBookData("https://openlibrary.org/search.json?q=the+sun+also+rises");
//  */
// async function getBookData(
//     url = "https://openlibrary.org/search.json?q=the+sun+also+rises"
// ) {
//     try {
//         // Query Open Library's API:
//         const response = await axios.get(url);
//         // Get first result for search URL:
//         const firstResult = response.data.docs[0];
//         // Parse and save book title and author:
//         const bookTitle = firstResult.title;
//         const authorName = firstResult.author_name[0];
//         const isbnResults = firstResult.isbn || [];
//         // Save first 10-digit ISBN number:
//         const isbnString =
//             isbnResults.find((isbn) => isbn.length === 10) || "";
//         return { title: bookTitle, author: authorName, isbn: isbnString };
//     } catch (error) {
//         console.error("Error in getBookData function:", error);
//         // Return null to handle errors upstream:
//         return null;
//     }
// }

/* ↓↓ FOR LOCAL TESTING w/ARRAY INSTEAD OF DATABASE: ↓↓
let book_test_array = [
    {
        id: 0,
        book_title: "Flight Path",
        book_author: "Jan David Blais",
        book_url: "https://covers.openlibrary.org/b/isbn/0965460703-L.jpg",
        book_recommender: "Andrew",
        book_comments: "A great story about behind-the-scenes conflict in the world of aviation.",
    },
    {
        id: 1,
        book_title: "I Know Why the Caged Bird Sings",
        book_author: "Maya Angelou",
        book_url: "https://covers.openlibrary.org/b/isbn/1680840401-L.jpg",
        book_recommender: "Andrew",
        book_comments: "Wow! This story really moved me!",
    },
    {
        id: 2,
        book_title: "Ubik",
        book_author: "Philip K. Dick",
        book_url: "https://covers.openlibrary.org/b/isbn/1857988531-L.jpg",
        book_recommender: "Frida",
        book_comments: "It's hard to describe, but I recommend it...",
    },
    {
        id: 3,
        book_title: "The Elephant in the Brain",
        book_author: "Kevin Simler & Robin Hanson",
        book_url: "https://covers.openlibrary.org/b/isbn/0197551955-L.jpg",
        book_recommender: "Chen",
        book_comments: "Read this to better understand people's motivations.",
    },
];
*/

// Boolean to track whether a book was not found;
//  displayed on the home page if true:
let bookNotFoundBool = false;

// Route to display the web app's home page.
// Queries the database for book recommendations:
app.get("/", async (req, res) => {
    // View book list only if user registered/signed in:
    // NEW:
    if (req.isAuthenticated()) {
        try {
            const bookDBQuery = await db.query(
                "SELECT * from book_recommendations ORDER by id ASC"
            );
            const bookDBArray = bookDBQuery.rows;
            res.render("index.ejs", {
                /* ↓↓ FOR LOCAL TESTING w/ARRAY INSTEAD OF DATABASE: ↓↓
            // bookRecommendations: book_test_array,
            */
                bookRecommendations: bookDBArray,
                bookNotFound: bookNotFoundBool,
            });
            // Reset the error flag for future requests:
            bookNotFoundBool = false;
        } catch (error) {
            console.error("GET '/' error:", error);
            res.status(500).send("Internal Server Error");
        }
    } else {
        // Prompt user to log in if not registered/signed in:
        res.redirect("/login");
    }
});

// Route to display the web app's login page: // NEW
app.get("/login", (req, res) => {
    res.render("login.ejs");
});

// Route to display the web app's registration page: // NEW
app.get("/register", (req, res) => {
    res.render("register.ejs");
});

// NEW:
app.get(
    "/auth/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
    })
);

// NEW:
app.get(
    "/auth/google/",
    passport.authenticate("google", {
        successRedirect: "/",
        failureRedirect: "/login",
    })
);

// NEW:
app.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) console.log(err);
        res.redirect("/login");
    });
});

// NEW:
app.post(
    "/login",
    passport.authenticate("local", {
        successRedirect: "/",
        failureRedirect: "/login",
    })
);

// NEW:
app.post("/register", async (req, res) => {
    const email = req.body.userEmail;
    const password = req.body.password;

    try {
        const checkResult = await db.query(
            "SELECT * FROM users WHERE user_email = $1",
            [email]
        );

        if (checkResult.rows.length > 0) {
            res.send("Email already exists. Try logging in.");
            res.redirect("/login");
        } else {
            // Password hashing:
            bcrypt.hash(password, saltRounds, async (err, hash) => {
                if (err) {
                    console.error("Error hashing password:", err);
                } else {
                    const result = await db.query(
                        "INSERT INTO users (user_email, password) VALUES ($1, $2) RETURNING *",
                        [email, hash]
                    );
                    const user = result.rows[0];
                    req.login(user, (err) => {
                        console.log("User successfully registered!");
                        res.redirect("/");
                    });
                }
            });
        }
    } catch (err) {
        console.log("POST '/register' error:", err);
    }
});

// Route to handle user requests to add a new book recommendation.
// Updates the database with the provided book details:
app.post("/add", async (req, res) => {
    if (req.isAuthenticated()) {
        try {
            const { bookTitle, bookISBN, bookRecommender, bookComments } =
                req.body;
            const trimmedTitle = bookTitle?.trim();
            const trimmedISBN = bookISBN?.trim();
            const trimmedRecommender = bookRecommender?.trim();
            // Enforce length limit:
            const trimmedBookComments = bookComments?.trim().slice(0, 1000);

            const openLibraryPrefix = "https://openlibrary.org/search.json?";
            const librarySearchURL = trimmedTitle
                ? // ? `${openLibraryPrefix}title=${toSearchString(trimmedTitle)}`
                  `${openLibraryPrefix}title=${utilFunc.toSearchString(
                      trimmedTitle
                  )}`
                : `${openLibraryPrefix}isbn=${trimmedISBN}`;

            // const resultBookData = await getBookData(librarySearchURL);
            const resultBookData = await utilFunc.getBookData(
                librarySearchURL
            );

            if (resultBookData && resultBookData.title) {
                const dateAdded = new Date().toISOString().slice(0, 10);
                const imageURL = `https://covers.openlibrary.org/b/isbn/${resultBookData.isbn}-L.jpg`;

                await db.query(
                    `INSERT INTO book_recommendations
                     (book_title,
                      book_author,
                      book_url,
                      book_recommender,
                      date_added,
                      date_updated,
                      book_comments)
                 VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [
                        resultBookData.title,
                        resultBookData.author,
                        imageURL,
                        trimmedRecommender,
                        dateAdded,
                        dateAdded,
                        trimmedBookComments,
                    ]
                );
                // If API query doesn't work create entry with user data:
            } else {
                bookNotFoundBool = true;
                const blankBookPath = "/images/blankBook.png";
                const dateAdded = new Date().toISOString().slice(0, 10);
                await db.query(
                    `INSERT INTO book_recommendations
                     (book_title,
                      book_url,
                      book_recommender,
                      date_added,
                      date_updated,
                      book_comments)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                    [
                        bookTitle,
                        blankBookPath,
                        bookRecommender,
                        dateAdded,
                        dateAdded,
                        bookComments,
                    ]
                );
            }

            /* ↓↓ FOR LOCAL TESTING w/ARRAY INSTEAD OF DATABASE: ↓↓
        if (resultBookData.title) {
            const imageURL = `https://covers.openlibrary.org/b/isbn/${resultBookData.isbn}-L.jpg`;
            const dbId = book_test_array.length;
            book_test_array.push({
                id: dbId,
                bookImageURL: imageURL,
                title: resultBookData.title,
                author: resultBookData.author,
                recommendedBy: reqBookForm.recommendedBy,
            });
        */

            res.redirect("/");
        } catch (error) {
            console.error("POST '/add' error:", error);
            res.status(500).send("Internal Server Error");
        }
    } else {
        res.redirect("/login");
    }
});

// Route to allow user editing/customization of information in
//  the book recommendations:
app.post("/edit", async (req, res) => {
    if (req.isAuthenticated()) {
        try {
            const {
                bookDBId,
                editBookTitle,
                editBookAuthor,
                editBookImageURL,
                editBookRecommender,
                dateAdded,
                editBookComments,
            } = req.body;
            const dateUpdated = new Date().toISOString().slice(0, 10);

            await db.query(
                `UPDATE book_recommendations
             SET book_title=$1,
	             book_author= $2,
	             book_url=$3,
	             book_recommender=$4,
                 date_added=$5,
                 date_updated=$6,
                 book_comments=$7
            WHERE id=$8`,
                [
                    editBookTitle?.trim(),
                    editBookAuthor?.trim(),
                    editBookImageURL?.trim(),
                    editBookRecommender?.trim(),
                    dateAdded,
                    dateUpdated,
                    editBookComments?.trim().slice(0, 1000),
                    Number(bookDBId),
                ]
            );

            /* ↓↓ FOR LOCAL TESTING w/ARRAY INSTEAD OF DATABASE: ↓↓
        let bookToEdit = book_test_array[bookDBId];
        // Iterate over fields and update book object with user entries:
        fieldsToUpdate.forEach((field) => {
            // Trim input, `?` chaining operator to skip blank inputs:
            // const newValue = req.body[field] ? req.body[field].trim() : undefined;
            const newValue = req.body[field]?.trim();
            if (newValue) {
                const propertyName = fieldMap[field];

                bookToEdit[propertyName] = newValue;
            }
        });
        // Define array of field names for potential updating:
        const fieldsToUpdate = [
            "editBookTitle",
            "editBookAuthor",
            "editBookImageURL",
            "editBookRecommender",
        ];

        // Map field names to book object property names:
        const fieldMap = {
            editBookTitle: "book_title",
            editBookAuthor: "book_author",
            editBookImageURL: "book_url",
            editBookRecommender: "book_recommender",
        };
        */
        } catch (error) {
            console.error("POST '/edit' error:", error);
            res.status(500).send("Internal Server Error");
        }
        res.redirect("/");
    } else {
        res.redirect("/login");
    }
});

// Route for user to delete book from recommendations:
app.post("/delete", async (req, res) => {
    if (req.isAuthenticated()) {
        try {
            const bookDBId = Number(req.body.bookDBId);

            /* ↓↓ FOR LOCAL TESTING w/ARRAY INSTEAD OF DATABASE: ↓↓
        book_test_array = book_test_array.filter((book) => book.id !== bookDBId);
        */

            await db.query(
                "DELETE FROM book_recommendations WHERE id = ($1)",
                [bookDBId]
            );
        } catch (error) {
            // Log errors:
            console.error("POST '/delete' error:", error);
            res.status(500).send("Internal Server Error");
        }
        res.redirect("/");
    } else {
        res.redirect("/login");
    }
});

// *  *  * *  *  *  *   * *  *  * //
// *  *  * PASSPORT STUFF *  *  * //
// *  *  * *  *  *  *   * *  *  * //
passport.use(
    "local",
    new LocalStrategy(async function verify(userEmail, password, cb) {
        // console.log(username);
        try {
            const result = await db.query(
                "SELECT * FROM users where user_email = $1",
                [userEmail]
            );
            if (result.rows.length > 0) {
                const user = result.rows[0];
                const storedHashedPassword = user.password;

                bcrypt.compare(
                    password,
                    storedHashedPassword,
                    (err, valid) => {
                        if (err) {
                            console.error("Error comparing passwords:", err);
                            return cb(err);
                        } else {
                            if (valid) {
                                return cb(null, user);
                            } else {
                                return cb(null, false);
                            }
                        }
                    }
                );
            } else {
                return cb("User not found");
            }
        } catch (err) {
            return cb(err);
        }
    })
);

passport.use(
    "google",
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: "http://localhost:3000/auth/google/",
            userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
        },
        async (accessToken, refreshToken, profile, cb) => {
            const userEmail = profile.emails[0].value;
            try {
                const result = await db.query(
                    "SELECT * FROM users WHERE user_email = $1",
                    [userEmail]
                );
                if (result.rows.length === 0) {
                    const newUser = await db.query(
                        "INSERT INTO users (user_email, password) VALUES ($1, $2",
                        [userEmail, "googleSignInUser"]
                    );
                    cb(null, newUser.rows[0]);
                } else {
                    // Already existing user:
                    cb(null, result.rows[0]);
                }
            } catch (err) {
                return cb(err);
            }
        }
    )
);

passport.serializeUser((user, cb) => {
    cb(null, user);
});

passport.deserializeUser((user, cb) => {
    cb(null, user);
});

// Allow access to web page (here, locally for testing):
app.listen(serverPort, () => {
    console.log(`Server running on port ${serverPort}`);
});
