import axios from "axios";
async function dadJoke(
    url = "https://icanhazdadjoke.com",
    headers = {
        Accept: "text/plain",
        "User-Agent": "anb.daily email | anb2015@gmail.com",
    }
) {
    try {
        const response = await axios.get(url, { headers: headers });
        return response.data;
    } catch (error) {
        console.error("Error retrieving dad joke:", error);
    }
}

export { dadJoke };
