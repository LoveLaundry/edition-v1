import "dotenv/config";
import { app } from "../api/chat";

const PORT = Number(process.env.PORT) || 3001;

app.listen(PORT, () => {
    console.log(`Love Laundry bot listening on http://localhost:${PORT}`);
});
