import axios from "axios";

// * * * * * * ** * * * * * * //
// * * * BOOK FUNCTIONS * * * //
// * * * * * * ** * * * * * * //
/**
 * Formats a user-provided title string by removing spaces,
 * converting to lowercase, and joining words with the '+' character.
 * This formatted string is suitable for use in URLs.
 *
 * @param {string} titleString - The user input string representing a book title.
 * @returns {string} The formatted search string.
 * @example
 * // Returns the+sun+also+rises
 * toSearchString("The Sun Also Rises");
 */
function toSearchString(titleString) {
    try {
        return titleString.trim().toLowerCase().split(" ").join("+");
    } catch (error) {
        console.error("Error in toSearchString function:", error);
        // Return empty string on error to prevent undefined behavior:
        return "";
    }
}

/**
 * Fetches book data from the Open Library API using the provided URL.
 * Returns an object containing the book's title, author, and ISBN number.
 *
 * @param {string} url - The URL to query the Open Library API.
 * @returns {object} An object containing the book's title, author, and ISBN.
 * @example
 * // Returns { title: The Sun Also Rises, author: Ernest Hemingway, isbn: "0330105515" }
 * getBookData("https://openlibrary.org/search.json?q=the+sun+also+rises");
 */
async function getBookData(
    url = "https://openlibrary.org/search.json?q=the+sun+also+rises"
) {
    try {
        // Query Open Library's API:
        const response = await axios.get(url);
        // Get first result for search URL:
        const firstResult = response.data.docs[0];
        // Parse and save book title and author:
        const bookTitle = firstResult.title;
        const authorName = firstResult.author_name[0];
        const isbnResults = firstResult.isbn || [];
        // Save first 10-digit ISBN number:
        const isbnString =
            isbnResults.find((isbn) => isbn.length === 10) || "";
        return { title: bookTitle, author: authorName, isbn: isbnString };
    } catch (error) {
        console.error("Error in getBookData function:", error);
        // Return null to handle errors upstream:
        return null;
    }
}

export { toSearchString, getBookData };
