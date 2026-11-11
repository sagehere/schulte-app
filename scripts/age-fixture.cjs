// Deterministic age fixtures relative to the application's default calendar.
module.exports=age=>String(Number(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'}).format(new Date()).slice(0,4))-age)+'-01-01';
