const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const { execSync, ChildProcess } = require("node:child_process");


async function getDB() {
    const { JSONFilePreset } = await import("lowdb/node");
    let DBoptions = { Download: [] }
    let db = await JSONFilePreset('DownloadDb.json', DBoptions);
    return db;
}


app.use(bodyParser.urlencoded({ extended: true }));

app.get("/", (req, res) => {
    res.send("Hello World ! If you seeing this the api is working")
});
app.get("/redownload/:ID", async (req, res) => {
    const downloadID = req.params.ID;
    if (!downloadID) {
        return res.status(400).send("Invalid Request");
    }
    let db = await getDB();
    let downloadFile = db.data.Download.find({ id: downloadID }).value();
    if (!downloadFile) {
        return res.status(404).send("Download not found");
    }
    let file = __dirname + "/downloads/" + downloadFile.filename;
    res.download(file);
    
})
app.get("/downloadpreset/:NAME", async (req, res) => {
    const type = req.params.NAME;
    let db = await getDB();
    if (!type || type === null) {
        return res.status(400).send("Invalid Request");
    }
    if (type === "youtube") {
        if (!req.query.id) {
            return res.status(400).send("Invalid Request");
        }
        const id = req.query.id;

        const title = await execSync(`yt-dlp --get-title "${id}" --no-warnings`).toString();
        console.log(title)
        if (title.includes("ERROR")) {
            return res.status(400).send("Invalid Request");
        }
        const ytdlpOUTPUT = await execSync(`yt-dlp  -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b" "${id}" -o "./downloads/output-${title}.%(ext)s"  --audio-multistreams --no-playlist`).toString();
        if (ytdlpOUTPUT.includes("ERROR")) {
            return res.status(400).send("Invalid Request");
        }
        console.log(ytdlpOUTPUT)
        //thankyou sonet for the REGEX I FUCKING HATE REGEX
        const match = ytdlpOUTPUT.match(/\[Merger\] Merging formats into "downloads\\output-(.*?)\.([^"]+)"/);
        if (!match) {
            if(ytdlpOUTPUT.includes("downloaded")){
                console.log("File already downloaded")
             let file = (await db.data.Download).find((download) => { return download.filename == `output-${title}.mp4`});
             console.log(file)
             return res.redirect(`/redownload/${file.id}`);
            }
            return res.status(502).send("Internal Server Error");
        }
        console.log(match)
        const ext = match[2];
        let dbId = Date.now();
        await db.data.Download.push({ id: dbId, filename: `output-${match[1]}.${ext}` });
        await db.write()
        res.download(`output-${match[1]}.${ext}`);
        
        return;
    }


    res.status(200).send("Downloaded")
});

app.get("/download", async (req, res) => {
    const link = req.query.link;
    console.log(req.query)
    if (!link || link === null) {
        return res.status(400).send("Invalid Request");
    }
        let farameters = req.query.farameters;
        let downloadFolder = __dirname + "/downloads";
        if(!farameters){
            farameters = "-f best";
        }
        const ytdlpOutput = execSync(`yt-dlp ${farameters} -o "${downloadFolder}/%(title)s.%(ext)s" ${link}`).toString();
        if(ytdlpOutput.includes("ERROR")){
            return res.status(400).send("Invalid Request");
        }
        

    


});

app.listen(8000, () => {
    console.log("Server is now running on port 8000")
})