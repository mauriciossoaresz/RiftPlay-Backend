const path=require('path');require('dotenv').config({path:path.resolve(__dirname,'..','.env')});
const mongoose=require('mongoose');const connect=require('../config/db');
const Time=require('../models/Time');const Jogador=require('../models/Jogador');
const bcrypt=require('bcryptjs');const randCpf=()=>String(Math.floor(1e10+Math.random()*9e10));
(async()=>{
  await connect(); const now=Date.now(), pass=bcrypt.hashSync('123456',10);
  const mk=async(n,p)=>Jogador.insertMany(Array.from({length:n},(_,i)=>({
    nome:`${p}_p${i+1}`, nickname:`${p}_${now}_${i+1}`, email:`${p}_${now}_${i+1}@seed.local`,
    cpf:randCpf(), senhaHash:pass, saldo:500, allowance:200, isCapitao:i===0
  })));
  const p5=await mk(5,'t5'), p3=await mk(3,'t3');
  const t5doc={ nome:`seed_team5_${now}`, players:p5.map(x=>x._id), capitaoId:p5[0]._id, maxMembros:5 };
  const t3doc={ nome:`seed_team3_${now}`, players:p3.map(x=>x._id), capitaoId:p3[0]._id, maxMembros:5 };
  const t5=await Time.create(t5doc); const t3=await Time.create(t3doc);
  await Jogador.updateMany({_id:{$in:p5.map(x=>x._id)}},{ $set:{ timeId:t5._id } });
  await Jogador.updateMany({_id:{$in:p3.map(x=>x._id)}},{ $set:{ timeId:t3._id } });
  console.log('TEAM5:',t5._id.toString()); console.log('CAPTAIN5:',p5[0]._id.toString());
  console.log('TEAM<5:',t3._id.toString()); process.exit(0);
})().catch(e=>{ console.error('SEED_ERR:', e.message); console.error(e.errors||e); process.exit(1); });
