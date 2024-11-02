// Import necessary libraries for the project:
import bodyParser from "body-parser";
import bcrypt from "bcrypt";
import { config } from "dotenv";
import express from "express";
import passport from "passport";
import pg from "pg";
import session from "express-session";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";

// Import local modules:
import * as utilFunc from "./public/js/utilityFunctions.js";

const app = express(); // Create instance of Express application
const serverPort = 3000; // Define port where server listens for requests
const saltRounds = 10; // Define num salt rounds for encryption/decryption

config();

app.use(
    session({
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: true,
        cookie: { maxAge: 1000 * 60 * 60 * 24 },
    })
);

app.use(bodyParser.urlencoded({ extended: true })); // Enable parsing URL-encoded data from incoming requests
app.use(express.static("public")); // Serve static files from `public` directory
app.use(passport.initialize());
app.use(passport.session());

// Configure connection to PostgreSQL database managed by pgAdmin 4:
const db = new pg.Client({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Establish connection to PostgreSQL database:
db.connect().catch((err) => {
    console.error("Failed to connect to the database:", err);
    process.exit(1);
});

let bookNotFoundBool = false; // Boolean tracking if book was not found

// Route to display the web app's login page:
app.get("/", (req, res) => {
    if (req.isAuthenticated()) {
        res.redirect("/books");
    } else {
        console.log("Rendering login.ejs");
        res.render("login.ejs");
    }
});

// Route displaying web app home page:
app.get("/books", async (req, res) => {
    // View book list only if user registered/signed in:
    if (req.isAuthenticated()) {
        try {
            // Queries the database for book recommendations:
            const bookDBQuery = await db.query(
                "SELECT * from book_recommendations ORDER by id ASC"
            );
            const bookDBArray = bookDBQuery.rows;
            res.render("books.ejs", {
                bookRecommendations: bookDBArray,
                bookNotFound: bookNotFoundBool,
            });

            bookNotFoundBool = false; // Reset error flag for future requests
        } catch (error) {
            console.error("GET '/' error:", error);
            res.status(500).send("Internal Server Error");
        }
    } else {
        res.redirect("/"); // Prompt login if not registered/signed in
    }
});

// Route displaying web app registration page:
app.get("/register", (req, res) => {
    res.render("register.ejs");
});

app.get(
    "/auth/google",
    passport.authenticate("google", {
        scope: ["profile", "email"],
    })
);

app.get(
    "/auth/google/books",
    passport.authenticate("google", {
        successRedirect: "/books",
        failureRedirect: "/",
    })
);

app.get("/logout", (req, res) => {
    req.logout((err) => {
        if (err) {
            console.log(err);
            return next(err);
        }
        res.redirect("/");
    });
});

app.post(
    "/",
    (req, res, next) => {
        console.log("User email:", req.body.username);
        console.log("User password:", req.body.password);
        next();
    },
    passport.authenticate("local", {
        successRedirect: "/books",
        failureRedirect: "/",
    })
);

app.post("/register", async (req, res) => {
    const email = req.body.username;
    const password = req.body.password;

    try {
        if (email === "" || password === "") {
            res.redirect("/");
        } else {
            const checkResult = await db.query(
                "SELECT * FROM users WHERE user_email = $1",
                [email]
            );

            if (checkResult.rows.length > 0) {
                res.send("Email already exists. Try logging in.");
                res.redirect("/");
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
                            res.redirect("/books");
                        });
                    }
                });
            }
        }
    } catch (err) {
        console.log("POST '/register' error:", err);
        res.redirect("/");
    }
});

// Route handling requests to add new book recommendation:
app.post("/add", async (req, res) => {
    if (req.isAuthenticated()) {
        try {
            const { bookTitle, bookISBN, bookRecommender, bookComments } =
                req.body;
            const trimmedTitle = bookTitle?.trim();
            const trimmedISBN = bookISBN?.trim();
            const trimmedRecommender = bookRecommender?.trim();
            const trimmedBookComments = bookComments?.trim().slice(0, 1000); // Enforce length limit

            const openLibraryPrefix = "https://openlibrary.org/search.json?";
            const librarySearchURL = trimmedTitle
                ? `${openLibraryPrefix}title=${utilFunc.toSearchString(
                      trimmedTitle
                  )}`
                : `${openLibraryPrefix}isbn=${trimmedISBN}`;
            const resultBookData = await utilFunc.getBookData(
                librarySearchURL
            );

            if (resultBookData && resultBookData.title) {
                const dateAdded = new Date().toISOString().slice(0, 10);
                const imageURL = `https://covers.openlibrary.org/b/isbn/${resultBookData.isbn}-L.jpg`;
                // Update database with API's book details:
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
            } else {
                // If API query doesn't work directly create entry with user data:
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
            res.redirect("/books");
        } catch (error) {
            console.error("POST '/add' error:", error);
            res.status(500).send("Internal Server Error");
        }
    } else {
        res.redirect("/");
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
        } catch (error) {
            console.error("POST '/edit' error:", error);
            res.status(500).send("Internal Server Error");
        }
        res.redirect("/books");
    } else {
        res.redirect("/");
    }
});

// Route for user to delete book from recommendations:
app.post("/delete", async (req, res) => {
    if (req.isAuthenticated()) {
        try {
            const bookDBId = Number(req.body.bookDBId);
            await db.query(
                "DELETE FROM book_recommendations WHERE id = ($1)",
                [bookDBId]
            );
        } catch (error) {
            console.error("POST '/delete' error:", error); // Log errors
            res.status(500).send("Internal Server Error");
        }
        res.redirect("/books");
    } else {
        res.redirect("/");
    }
});

// *  *  * *  *  *  *   * *  *  * //
// *  *  * PASSPORT STUFF *  *  * //
// *  *  * *  *  *  *   * *  *  * //
passport.use(
    "local",
    new LocalStrategy(async function verify(username, password, cb) {
        console.log(username);
        try {
            const result = await db.query(
                "SELECT * FROM users where user_email = $1",
                [username]
            );
            if (result.rows.length > 0) {
                const user = result.rows[0];
                console.log(user);
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
                                console.log("Valid.");
                                return cb(null, user);
                            } else {
                                console.log("Invalid.");
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
            callbackURL: "http://localhost:3000/auth/google/books",
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
                        "INSERT INTO users (user_email, password) VALUES ($1, $2)",
                        [userEmail, "googleSignInUser"]
                    );
                    cb(null, newUser.rows[0]);
                } else {
                    cb(null, result.rows[0]); // Already existing user
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
