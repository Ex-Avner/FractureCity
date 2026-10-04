'use strict';
const fs=require('node:fs'),path=require('node:path');
const filename=process.env.DB_PATH||path.join(__dirname,'data','districts.sqlite');
fs.mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});
// A fresh mounted volume starts root-owned. Drop privileges before opening the database or listening.
if(process.getuid&&process.getuid()===0){fs.chownSync(path.dirname(filename),1000,1000);for(const suffix of ['', '-wal','-shm'])if(fs.existsSync(filename+suffix))fs.chownSync(filename+suffix,1000,1000);process.setgid(1000);process.setuid(1000)}
const {createServer}=require('./server.cjs'),app=createServer({dbPath:filename});
app.server.listen(Number(process.env.PORT||8787),process.env.HOST||'127.0.0.1',()=>console.log('Fracture City persistent district server listening on '+(process.env.PORT||8787)));
const backupDir=process.env.BACKUP_DIR||path.join(path.dirname(filename),'backups');let backingUp=false;
async function dailyBackup(){if(backingUp)return;backingUp=true;try{fs.mkdirSync(backupDir,{recursive:true,mode:0o700});const target=path.join(backupDir,'districts-'+new Date().toISOString().slice(0,10)+'.sqlite');if(!fs.existsSync(target))await app.store.backup(target)}catch(e){console.error('Database backup failed:',e.message)}finally{backingUp=false}}
dailyBackup();const backupTimer=setInterval(dailyBackup,3600000);backupTimer.unref();
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{clearInterval(backupTimer);app.close();setTimeout(()=>process.exit(0),1500).unref()});
