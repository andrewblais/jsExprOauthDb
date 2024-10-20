import * as utilFunc from "./utilityFunctions.js";
import * as testFunc from "./testingFunctions.js";

const searchString = utilFunc.toSearchString("Where the Wild Things Are");
console.log(searchString);

const bookData = utilFunc.getBookData(
    "https://openlibrary.org/search.json?q=where+the+wild+things+are"
);
console.log(bookData);

const joke = await testFunc.dadJoke();
console.log(joke);
