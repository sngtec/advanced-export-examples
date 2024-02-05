import express from "express";
import fs from "fs";
import { timesInStatuses, printStats } from "./stats";

const app = express();
app.use(express.json());

const UPLOAD_DIR = "./uploads";

app.post("/upload", (req, res) => {
    const contentDisposition = req.headers["content-disposition"];
    const contentType = req.headers["content-type"];

    if (contentType === "application/json") {
        const body = req.body;

        // collect times per each status
        const timesPerStatus = timesInStatuses("status", "ae_timeToNextChange", body.rows);

        // use the collected times to calculate basic stats
        printStats(timesPerStatus);

        res.sendStatus(200);
    } else if (contentDisposition) {
        // process file attachement
        let filename = "file.dat";

        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        let matches = filenameRegex.exec(contentDisposition);
        if (matches != null && matches[1]) {
            filename = matches[1].replace(/['"]/g, "");
        }

        const writeStream = fs.createWriteStream(`${UPLOAD_DIR}/${filename}`);

        req.pipe(writeStream);

        writeStream.on("finish", () => {
            console.log(`Received file ${filename}, ${contentType}`);
            res.sendStatus(200);
        });

        writeStream.on("error", (err) => {
            console.error(`Error writing file: ${err.message}`);
            res.sendStatus(500);
        });
    }
});

app.listen(3002, () => {
    console.log("Server listening on port 3002");
});
