const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const { execSync, ChildProcess } = require("node:child_process");
const fs = require("node:fs");


app.use(bodyParser.urlencoded({ extended: true }));

async function getDB() {
    const { JSONFilePreset } = await import("lowdb/node");
    let DBoptions = { Download: [] }
    let db = await JSONFilePreset('DownloadDb.json', DBoptions);
    return db;
}

app.get("/", (req, res) => {
    res.send("Hello World ! If you seeing this the api is working")
});

app.get("/redownload/:ID", async (req, res) => {
    let db = await getDB();
    let fileID = req.params.ID;
    if (!fileID) {
        return res.status(400).send("Invalid Request");
    }
    let file = db.data.Download.find((download) => { return download.id == fileID });
    if (!file) {
        return res.status(404).send("File not found");
    }
    res.download(__dirname + "/downloads/" + file.filename);
});


app.get("/download/*", async (req, res) => {
    console.log(req.query)
    const downloadType = req.params[0];
    if (!downloadType) {
        return res.status(400).send("Invalid Request");
    }
    if (downloadType == "youtube") {
        //get link from param (?link=)
        let ytLink = req.query.link
        let preset = req.query.preset ? req.query.preset : false;
        let params = req.query.params ? req.query.params : "";
        let db = await getDB();

        if (!ytLink) { return res.status(400).send("Invalid Request"); }

        if (preset == true) {
            let ytTitle = await execSync(`./yt-dlp --get-title "${ytLink}" --no-warnings`).toString().replace("\n", "").replace("\r", "").replace("\t", "").replace(".", "");
            if (ytTitle.includes("ERROR")) {
                return res.status(400).send("Invalid Request");
            }
            let ytOutput = await execSync(`./yt-dlp  -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b" "${ytLink}" -o "./downloads/output-${ytTitle}.%(ext)s"  --audio-multistreams --no-playlist`).toString();
            if (ytOutput.includes("ERROR")) {
                return res.status(400).send("Invalid Request");
            }
            const match = ytOutput.match(/\[Merger\] Merging formats into "\.\/downloads\/output-(.*?)\.([^"]+)"/);
            if (!match) {
                if (ytOutput.includes("downloaded")) {
                    console.log("File already downloaded")
                    let file = (await db.data.Download).find((download) => {
                        return download.filename.startsWith(`output-${ytTitle}.`);
                    });
                    res.render(__dirname + "/public/index",{fileID: file.id})
                    return;
                }
                res.status(502).send("Server is having external crisis")
                return;
            }
            const ext = match[2];
            let fileID = Date.now();
            await db.data.Download.push({ id: fileID, filename: `output-${ytTitle}.${ext}` });
            await db.write();
            res.render(__dirname + "/public/index",{fileID: fileID})
            return;
        }
        let ytTitle = await execSync(`./yt-dlp --get-title "${ytLink}" --no-warnings`).toString().replace("\n", "").replace("\r", "").replace("\t", "").replace(".", "");
        console.log(ytTitle)
        if (ytTitle.includes("ERROR")) {
            return res.status(400).send("Invalid Request");
        }
        let YtOutput = await execSync(`./yt-dlp ${params} ${ytLink} -o "./downloads/output-${ytTitle}.%(ext)s"`).toString();
        if (YtOutput.includes("ERROR")) {
            return res.status(400).send("Invalid Request");
        }
        let match = "";
        if (YtOutput.includes("Merger")) {
            match = YtOutput.match(/\[Merger\] Merging formats into "\.\/downloads\/output-(.*?)\.([^"]+)"/);
        }
        if (!YtOutput.includes("Merger")) {
            match = YtOutput.match(/\[Download\] Destination: "\.\/downloads\/output-(.*?)\.([^"]+)"/);
        }
        console.log(YtOutput);
        console.log(match);
        if (!match) {
            if (YtOutput.includes("downloaded")) {
                console.log("File already downloaded")
                let file = (await db.data.Download).find((download) => {
                    return download.filename.startsWith(`output-${ytTitle}.`);
                });
                if (!file) { return console.log("no File found!"), res.status(404).send("File not found"); }
                console.log(file)
                res.render(__dirname + "/public/index",{fileID: file.id})
                return;
            }
            return res.status(502).send("Server is having external crisis");
        }
        const ext = match[2];
        let fileID = Date.now();
        await db.data.Download.push({ id: fileID, filename: `output-${ytTitle}.${ext}` });
        await db.write();
        res.render(__dirname + "/public/index",{fileID: fileID})
        return;
    }


});


app.post("/delete/:ID", async (req, res) => {
    let db = await getDB();
    let fileID = req.params.ID;
    if (!fileID) {
        return res.status(400).send("Invalid Request");
    }
    let file = db.data.Download.find((download) => { return download.id == fileID });
    if (!file) {
        return res.status(404).send("File not found");
    }
    db.data.Download = db.data.Download.filter(item => item.id != fileID);
    fs.unlinkSync(__dirname + "/downloads/" + file.filename);
    await db.write();
    res.status(200).send("File Deleted");
});





app.get("/ai", (req, res) => {
    //soon tm
});



app.listen(process.env.PORT || 8000, () => {
    console.log(`Server is running on port ${process.env.PORT || 8000}\n http://localhost:${process.env.PORT || 8000}`);
});
