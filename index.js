const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const { execSync, ChildProcess, spawn, exec, execFile } = require("node:child_process");
const fs = require("node:fs");

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));



let ytdlpExecutable = "./executable/yt-dlp"
let downloadFolder = "./downloads/"


async function getDB() {
    const { JSONFilePreset } = await import("lowdb/node");
    let DBoptions = { Download: [] }
    let db = await JSONFilePreset('DownloadDb.json', DBoptions);
    return db;
}

async function ytdlpDownload(YT_link, params, id) {
    let fileNameArray = []
    let db = await getDB()
    let regex = /(youtu.*be.*)\/(watch\?v=|embed\/|v|shorts|)(.*?((?=[&#?])|$))/gm;
    let ytid = regex.exec(YT_link)[3];
    if (ytid === null) { return false; }
    if (YT_link === null) { return false; }
    let output = exec(`python ${ytdlpExecutable} ${ytid} ${params} -o "./downloads/output-${ytid}.%(ext)s" --audio-multistreams --no-playlist`)
    console.log(`python ${ytdlpExecutable} ${ytid} ${params} -o "./downloads/output-${ytid}.%(ext)s" --audio-multistreams --no-playlist`)
    output.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });
    output.stderr.on('data', (data) => {
        console.log(`stderr: ${data}`);
    });
    output.on("close", async (code) => {
        console.log(code)
        if(code===1){return false;}
        fs.readdirSync(downloadFolder).forEach(file => {
            if (file.includes(ytid)) { fileNameArray.push(file) }
        });
        if(fileNameArray.length=0){return false;}
        let status = db.data.Download.findIndex((download) => { return download.id == id })
        if (status === -1) { return false; }
        db.data.Download[status] = { id: id, filename: fileNameArray[0], status: true,ytid:ytid }
        await db.write();
        return true;
    });
    return true;

}

app.get("/", (req, res) => {
    res.send("Hello World ! If you seeing this the api is working")
});

app.get("/redownload/:ID", async (req, res) => {
    let db = await getDB();
    let fileID = req.params.ID;
    if (!fileID) {
        return res.status(400).send({message:"Invalid Request"});
    }
    let file = db.data.Download.find((download) => { return download.id == fileID });
    if (!file) {
        return res.status(404).send({message:"File not found"});
    }
    if (file.status === false) {
        return res.status(202).send({ message: "File is still downloading, please wait!" })
    }
    res.download(__dirname + "/downloads/" + file.filename);
});

app.get("/download", async (req, res) => {

    let ytLink = req.query.link
    let preset = req.query.preset ? req.query.preset : false;
    let params = req.query.params ? req.query.params : "";
    let db = await getDB();

    if (!ytLink) { return res.status(400).send({ message: "Invalid Request" }); }

    let regex = /(youtu.*be.*)\/(watch\?v=|embed\/|v|shorts|)(.*?((?=[&#?])|$))/gm;
    let ytid = regex.exec(ytLink)[3];
    if (ytid === null) { return res.status(400).send("Invalid Request"); }

    let file = db.data.Download.find((download) => { return download.ytid == ytid });
    if (file) {
        if (file.status === true) { return res.render(__dirname + "/public/index", { fileID: file.id }); }
        return res.status(400).send({ message: `Duplicate request! try GET /status/${file.id}`, id: file.id, ytid: ytid });
    }


    if (preset === true) {
        let id = Date.now()
        db.data.Download.push({ status: false, id: id, ytid: ytid })
        await db.write();
        ytdlpDownload(ytLink, `-f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4] / bv*+ba/b"`, id)
        res.status(202).send({ status: "Downloading...", message: "Got the request, file is now downloading.", id: id, ytid: ytid })
        return;
    }

    let id = Date.now()
    db.data.Download.push({ status: false, id: id, ytid: ytid })
    await db.write();
    ytdlpDownload(ytLink, params, id)
    res.status(202).send({ status: "Downloading...", message: "Got the request, file is now downloading.", id: id, ytid: ytid })
    return;
});

app.get("/status/:ID", async (req, res) => {
    let db = await getDB();
    let fileID = req.params.ID;
    if (!fileID) {
        return res.status(400).send({message:"Invalid Request"});
    }
    let file = db.data.Download.find((download) => { return download.id == fileID });
    if (!file) {
        return res.status(404).send({message:"File not found"});
    }
    res.send(file)
})


app.post("/delete/:ID", async (req, res) => {
    let db = await getDB();
    let fileID = req.params.ID;
    if (!fileID) {
        return res.status(400).send({message:"Invalid Request"});
    }
    let file = db.data.Download.find((download) => { return download.id == fileID });
    if (!file) {
        return res.status(404).send({message:"File not found"});
    }
    db.data.Download = db.data.Download.filter(item => item.id != fileID);
    fs.unlinkSync(__dirname + "/downloads/" + file.filename);
    await db.write();
    res.status(200).send({message:"File Deleted"});
});

app.listen(process.env.PORT || 8000, () => {
    console.log(`Server is running on port ${process.env.PORT || 8000}\n http://localhost:${process.env.PORT || 8000}`);
});