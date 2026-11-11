const {localDateKey,isDateKey}=require('./utils');
function ageProfile(birthDate,now=new Date(),timeZone='Asia/Shanghai'){
 const today=localDateKey(now,timeZone);
 const born=new Date(birthDate+'T12:00:00Z');
 if(!isDateKey(birthDate)||Number.isNaN(born.getTime())||born.toISOString().slice(0,10)!==birthDate||birthDate>today)return {age:null,band:'unknown',label:'请先在用户中心补充有效生日',fixedAvailable:false};
 let age=Number(today.slice(0,4))-Number(birthDate.slice(0,4));if(today.slice(5)<birthDate.slice(5))age--;
 const band=age<6?'under6':age<=8?'6-8':age<=10?'9-10':age<=12?'11-12':age<=15?'13-15':'16+';
 const config={under6:[0,0,0,'请由家长陪同阅读，当前生成面向6岁及以上用户'], '6-8':[40,120,100,'短句、熟悉词汇、具体情境，一步关系；加减与整十数量'], '9-10':[100,260,1000,'小学中年级词汇、两步关系；整数四则、比较与单位'], '11-12':[160,400,10000,'小学高年级词汇、两至三步关系；小数、倍数与条件充分性'], '13-15':[220,550,100000,'适龄说明文、三步推理、证据与假设；比例与简单方程'], '16+':[250,700,1000000,'复杂句、因果与反事实、信息筛选；多步数量关系']}[band];
 return {age,band,label:age+'岁',minChars:config[0],maxChars:config[1],numberLimit:config[2],guidance:config[3],fixedAvailable:age>=7&&age<=12,maxFixedLevel:age<=8?1:age<=10?2:3,defaultLevel:age<=10?1:2};
}
function suitable(unit,profile){
 if(profile.age===null||profile.age<6)return false;
 if(unit.source==='ai')return unit.ageProfile?.band===profile.band;
 return profile.fixedAvailable&&unit.level<=profile.maxFixedLevel;
}
module.exports={ageProfile,suitable};
