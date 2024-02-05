import express from "express";
import fs from "fs";
import { timesInStatuses, printStats, groupByAndAccumulate, AccFunction, ACC_FUNCTIONS } from "./stats";

const app = express();
app.use(express.json());

const UPLOAD_DIR = "./uploads";

const router = express.Router();
app.use("/upload", router);

router.post("/file", (req, res) => {
    const contentDisposition = req.headers["content-disposition"];

    if (contentDisposition) {
        const contentType = req.headers["content-type"];
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
    } else {
        res.status(400).send("Content-Disposition header is required");
    }
});

router.post("/json_status_lead_times", (req, res) => {
    const contentType = req.headers["content-type"];
    const statusFieldId = req.query.statusFieldId as string || "status";

    if (contentType === "application/json") {
        const body = req.body;

        // collect times per each status
        const timesPerStatus = timesInStatuses(statusFieldId, "ae_timeToNextChange", body.rows);

        // use the collected times to calculate basic stats
        printStats(timesPerStatus);

        res.sendStatus(200);
    } else {
        res.status(400).send("Content-Type must be application/json");
    }
});

// group by field, then accumulate using specified function
router.post("/json_group_acc", (req, res) => {
    const contentType = req.headers["content-type"];
    const valueFieldId = req.query.valueFieldId as string;
    const groupByFieldId = req.query.groupByFieldId as string;
    const accFunction = req.query.accFunction as AccFunction || "sum";

    if (!valueFieldId || !groupByFieldId) {
        res.status(400).send("Query parameters valueFieldId and groupByFieldId are required");
        return;
    }
    if (!ACC_FUNCTIONS.includes(accFunction)) {
        res.status(400).send("Query parameter accFunction must be one of: " + ACC_FUNCTIONS.join(", "));
    }

    if (contentType === "application/json") {
        const body = req.body;
        groupByAndAccumulate(body.rows, body.columns, groupByFieldId, valueFieldId, accFunction);
        res.sendStatus(200);
    } else {
        res.status(400).send("Content-Type must be application/json");
    }
});

app.listen(3002, () => {
    console.log("Server listening on port 3002");
});
