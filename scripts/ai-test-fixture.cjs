function raw(module='reading'){
 const skills=require('../src/learning-ai').SKILLS[module];
 return {title:'图书角的安排',lines:['午休时，小林把三本故事书送回图书角，又把椅子移到窗边，让同学能安静阅读。管理员先检查书签，再请大家按顺序借阅。小林发现窗边太亮，于是拉上薄窗帘，保留足够光线。小芳原本想站着看书，看到空椅子后便坐了下来。两人约好读完各说一段有意思的内容，然后把书放回原位。'],demonstration:'先找到原文中的动作，再说明动作之间的联系。',steps:Array.from({length:3},(_,i)=>({skill:skills[i%skills.length],prompt:'小林为什么拉上薄窗帘？',options:module==='math-reading'&&i===2?['12张','10张','14张']:['因为窗边太亮','因为要离开','因为要关窗'],answers:['0'],hints:['找到窗边的描述','看看前后两句','把原因与行动连起来'],explanation:'文中说窗边太亮，所以拉上薄窗帘。',...(module==='math-reading'&&i===2?{math:{expression:'18-6',result:12}}:{})}))};
}
module.exports={raw};
