#!/usr/bin/env node

const { Bzip2 } = require("compressjs");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");

const { readdir, access, writeFile, readFile, mkdir } = require("fs/promises");
const { join, dirname } = require("path");


const argv = yargs(hideBin(process.argv))
	.command("process <folders...>", "process addon and gamemode directories for fastdl", yargs => {
		return yargs.positional("folders", {
			describe: "a list of folders that will be processed"
		});
	})
	.option("outdir", {
		type: "string",
		alias: "o",
		description: "Output directory for FastDL generated files"
	})
	.demandOption("outdir")
	.strictCommands()
	.demandCommand(1)
	.parse();

async function saveFile(outFile, fromFile, compress = false) {
	try {
		await access(outFile);
		console.log(`${outFile} exists, skipping`);
	} catch(e) {
		await mkdir(dirname(outFile), { recursive: true });
		console.log(`${fromFile} -> ${outFile}`);
		const fileData = await readFile(fromFile);
		await writeFile(outFile, compress ? Bzip2.compressFile(fileData) : fileData);
	}
}

async function process_file(root, ext, fname) {
	const outFile = join(argv.outdir, ext, fname).toLowerCase();
	const fromFile = join(root, ext, fname);
	await saveFile(outFile, fromFile);
	await saveFile(outFile + ".bz2", fromFile, true);

	if (fromFile !== fromFile.toLowerCase()) {
		await saveFile(fromFile.toLowerCase(), fromFile, false);
	}
}

async function iterate(root, ext) {
	let basedir = join(root, ext);
	console.log(`entering ${basedir}`);

	for (let dirent of await readdir(basedir, { withFileTypes: true })) {
		if (dirent.isFile()) {
			// todo: blacklist / whitelist extension
			await process_file(root, ext, dirent.name);
		}
		else if (dirent.isDirectory()) {
			await iterate(root, join(ext, dirent.name));
		}
	}

	console.log(`exiting ${basedir}`)
}

const contentDirectories = [
	"materials",
	"models",
	"sound",
	"maps",
	"particles",
	"resource"
];

async function iterate_content(root) {
	for (let contentDirectory of contentDirectories) {
		try {
			let thisDirectory = join(root, contentDirectory);
			await access(thisDirectory);
			await iterate(root, contentDirectory);
		}
		catch (e) { 
			console.log(`no access to ${contentDirectory}`);
		}
	}
}

async function iterate_root(root) {
	try {
		await access(join(root, "addon.json"));
		console.log(`detected ${root} as addon structure...`);
	}
	catch (e) {
		try {
			await access(join(root, "content"))
			console.log(`detected ${root} as gamemode structure...`);
			root = join(root, "content");
		}
		catch (e) {
			throw new Error(`couldn't determine ${root} file structure`)
		}
	}

	await iterate_content(root);
}

(async () => {
	for (let folder of argv.folders) {
		await iterate_root(folder);
	}
})().then(() => {
	console.log("completed");
}).catch(e => {
	console.error(e);
})