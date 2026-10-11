'use strict';
// Local operator access only. Never exposed as an HTTP route.
const path=require('node:path'),fs=require('node:fs'),{createStore}=require('./store.cjs'),{createSocial}=require('./social.cjs');
const file=process.env.DB_PATH||path.join(__dirname,'data','districts.sqlite');
if(!fs.existsSync(file)){console.error('Database not found.');process.exit(1)}
const store=createStore(file);try{createSocial(store.db);const [command,id]=process.argv.slice(2);if(command==='reports'){console.log(JSON.stringify(store.db.prepare('SELECT r.id,r.work,r.reason,r.created,a.username AS reporter,w.title,w.body FROM social_reports r JOIN accounts a ON a.id=r.author LEFT JOIN social_works w ON w.id=r.work ORDER BY r.created').all(),null,2))}else if(command==='remove'&&id){console.log('Works removed:',store.db.prepare('DELETE FROM social_works WHERE id=?').run(id).changes)}else if(command==='resolve'&&id){console.log('Reports resolved:',store.db.prepare('DELETE FROM social_reports WHERE id=?').run(id).changes)}else throw Error('Use reports, remove WORK_ID, or resolve REPORT_ID.')}finally{store.close()}
