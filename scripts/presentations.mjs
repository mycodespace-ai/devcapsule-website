import fs from "node:fs";
import path from "node:path";

// Selection is explicit. Older content revisions may predate a selected folder.
export const selectedFolders = [
  "devcapsule-webconsole/resources/presentations/todo-fastapi-postgres-react",
];

function problems(doc) {
  const found = [];
  const isText = (value) => typeof value === "string" && value.trim() !== "";
  const isFile = (value) => isText(value) && !value.includes("\\")
    && value.split("/").every((part) => part && part !== "." && part !== "..");
  const isTime = (value) => typeof value === "number" && Number.isFinite(value) && value >= 0;
  if (doc === null || typeof doc !== "object" || Array.isArray(doc)) return ["the document is not a JSON object"];
  if (doc.schema_version !== 1) found.push("schema_version must be 1");
  if (!isText(doc.title)) found.push("title is missing");
  const overview = doc.overview || {};
  if (!isText(overview.summary)) found.push("overview.summary is missing");
  if (overview.intent !== undefined && !isText(overview.intent)) found.push("overview.intent is not a text");
  if (overview.illustrates !== undefined && !(Array.isArray(overview.illustrates) && overview.illustrates.every(isText))) {
    found.push("overview.illustrates is not a list of texts");
  }
  if (overview.stack !== undefined && !(Array.isArray(overview.stack)
      && overview.stack.every((row) => row && isText(row.name) && isText(row.detail)))) {
    found.push("overview.stack is not a list of name and detail");
  }
  const video = doc.video || {};
  if (!isFile(video.file)) found.push("video.file is not a file name inside the folder");
  if (!isFile(video.poster)) found.push("video.poster is not a file name inside the folder");
  if (!(isTime(video.duration) && video.duration > 0)) found.push("video.duration is not a positive number of seconds");
  if (!Array.isArray(doc.steps) || doc.steps.length === 0) return found.concat(["steps is not a list with at least one step"]);
  let previousEnd = 0;
  doc.steps.forEach((step, index) => {
    const name = "step " + (index + 1);
    if (step === null || typeof step !== "object") { found.push(name + " is not an object"); return; }
    for (const field of ["title", "action", "expected"]) if (!isText(step[field])) found.push(name + ": " + field + " is missing");
    if (!isFile(step.screenshot)) found.push(name + ": screenshot is not a file name inside the folder");
    if (!(isTime(step.start) && isTime(step.end) && step.start < step.end)) {
      found.push(name + ": start and end are not seconds with start before end");
      return;
    }
    if (step.start < previousEnd) found.push(name + " starts before the step before it ends");
    if (isTime(video.duration) && step.end > video.duration) found.push(name + " ends after the recording");
    previousEnd = step.end;
    if (!Array.isArray(step.captions)) { found.push(name + ": captions is not a list"); return; }
    let captionEnd = step.start;
    step.captions.forEach((caption, position) => {
      const label = name + ", caption " + (position + 1);
      if (caption === null || typeof caption !== "object" || !isText(caption.text)
          || !(isTime(caption.start) && isTime(caption.end) && caption.start < caption.end)) {
        found.push(label + " needs a text, and start before end in seconds");
        return;
      }
      if (caption.start < captionEnd || caption.end > step.end) found.push(label + " overlaps its neighbour or leaves its step");
      captionEnd = caption.end;
    });
  });
  return found;
}

export function presentationPages(dir, assets, production) {
  const pages = [];
  for (const folder of selectedFolders) {
    if (!fs.existsSync(path.join(dir, folder))) continue;
    const file = folder + "/presentation.json";
    const doc = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    const issues = problems(doc);
    if (issues.length) throw new Error(file + ": " + issues.join(", "));
    const names = ["presentation.json", doc.video.file, doc.video.poster, ...doc.steps.map(step => step.screenshot)];
    for (const name of new Set(names)) {
      const asset = folder + "/" + name;
      const full = path.resolve(dir, asset);
      if (fs.realpathSync(full) !== full || !fs.statSync(full).isFile())
        throw new Error(asset + " must be a regular file inside the presentation folder.");
      assets.add(asset);
    }
    const media = "/content-assets/main/" + folder + "/";
    const url = "/presentations/" + path.basename(folder) + "/";
    pages.push({
      kind: "presentation", url, file, indexable: production, canonical: url,
      title: doc.title, description: doc.overview.summary, doc, media,
      videoUrl: media + doc.video.file.split("/").map(encodeURIComponent).join("/"),
      social: { image: media + doc.video.poster.split("/").map(encodeURIComponent).join("/") },
    });
  }
  return pages;
}

function cueTime(seconds) {
  const millis = Math.round(seconds * 1000);
  const hours = Math.floor(millis / 3600000);
  const minutes = Math.floor(millis / 60000) % 60;
  const secs = Math.floor(millis / 1000) % 60;
  return [hours, minutes, secs].map(n => String(n).padStart(2, "0")).join(":")
    + "." + String(millis % 1000).padStart(3, "0");
}

export function captionTrack(steps) {
  const cues = steps.flatMap(step => step.captions).map(({ start, end, text }) => {
    const plain = text.replace(/(``|`|\*\*|\*)(.+?)\1/g, (_, mark, value) => value.trim())
      .replace(/\s+/g, " ").trim().replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    return cueTime(start) + " --> " + cueTime(end) + "\n" + plain;
  });
  return "WEBVTT\n\n" + cues.join("\n\n") + "\n";
}
