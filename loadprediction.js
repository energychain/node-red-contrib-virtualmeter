const _ = require("lodash");

module.exports = function(RED) {
    let Influx = require('influx');


    function LoadPredictionNode(config) {
        RED.nodes.createNode(this,config);

        this.influxdbConfig = RED.nodes.getNode(config.influxdb);

        this.client =  this.influxdbConfig.client;
        var node = this;

        node.on('input', async function(msg) {
                let energy_reading = 0;
                let energy_request = await node.client.query('select last("energy") from '+config.name,{});
                if(energy_request.length > 0) {
                  energy_reading = energy_request[0].last;
                }
                let query = 'SELECT mean("power"),stddev("power"),min("power"),max("power") FROM "'+config.name+'" WHERE time>now()-7d GROUP BY time(1h) fill(previous)';
                let results = await node.client.query(query, {});
                let cleaned = [];
                for(let i=0;i<results.length;i++) {
                    if(results[i].mean !== null) {
                        let date = new Date(results[i].time);
                        results[i].hour = date.getHours();
                        results[i].day = date.getDay();
                        if((results[i].day >0) && (results[i].day <6)) {
                          results[i].weekend = 0;
                        } else {
                          results[i].weekend = 1;
                        }
                        cleaned.push(results[i]);
                  }
                }

                // Initialize Classification

                let class_hour = {};
                let class_weekend = {};
                let class_day = {};

                const mean = function(aobj) {
                    let sum = 0;
                    let cnt = 0;
                    for(let i=0;i<aobj.length;i++) {
                        sum += aobj[i].mean;
                        cnt++;
                    }
                    return sum/cnt;
                }

                const classStats = function(classification) {
                    let sum = 0;
                    let min = 999999999999;
                    let max = -99999999999;
                    let sum_stddev = 0;
                    let cnt = 0;

                    for (let c in classification) {
                        if(c !== "stats") {
                              for(let i=0;i<classification[c].length;i++) {
                                 sum += classification[c][i].mean;
                                 sum_stddev += classification[c][i].stddev;
                                 cnt ++;
                                 if(classification[c][i].min < min) min = classification[c][i].min;
                                 if(classification[c][i].max > max) max = classification[c][i].max;
                              }
                        }
                    }

                    classification.stats = {
                        min:min,
                        max:max,
                        mean:sum/cnt,
                        stddev: sum_stddev/cnt,
                        cnt:cnt,
                        sum:sum
                    }
                }

                const classify = function(classobject,candidate,fieldname) {
                    if(typeof classobject["c"+candidate[fieldname]] == "undefined") {
                        classobject["c"+candidate[fieldname]] = [];
                    }
                    classobject["c"+candidate[fieldname]].push(candidate);
                }

                // build Classifications
                for(let i=0; i<cleaned.length;i++) {
                    classify(class_hour,cleaned[i],'hour');
                    classify(class_weekend,cleaned[i],'weekend');
                    classify(class_day,cleaned[i],'day');
                }

                classStats(class_hour);
                classStats(class_weekend);
                classStats(class_day);


                for(let c in class_weekend) {

                  if(c !== "stats") {
                      let class_weekend_hour = {};
                      let class_weekend_day = {};
                      for(let i=0;i<class_weekend[c].length;i++) {
                          classify(class_weekend_hour,class_weekend[c][i],'hour');
                          classify(class_weekend_day,class_weekend[c][i],'day');
                      }

                      classStats(class_weekend_hour);
                      for(let d in class_weekend_hour) {
                          if(d !== "stats") {
                              classStats(class_weekend_hour[d]);
                          }
                      }

                      classStats(class_weekend_day);
                      for(let d in class_weekend_day) {
                          if(d !== "stats") {
                              classStats(class_weekend_day[d]);
                          }
                      }
                      if(typeof class_weekend.subclasses == "undefined") class_weekend.subclasses = {};

                      if(typeof class_weekend.subclasses[c] == "undefined") class_weekend.subclasses[c] = {};

                      class_weekend.subclasses[c].hour = class_weekend_hour;
                      class_weekend.subclasses[c].day = class_weekend_day;
                  }
              }

              // run prediction of upcomming 48 hours
              let date = new Date();
              date.setMinutes(0);
              date.setSeconds(0);
              date.setMilliseconds(0);
              let ts = date.getTime();
              let predictions = [];
              for(let i=0;i<72;i++) {
                // classes
                let hour = new Date(ts).getHours();
                let day = new Date(ts).getDay();
                let weekend = 1;
                if((day >0) && (day <6)) {
                    weekend = 0;
                }

                let power =0;
                let cnt = 0;
                let srcs = [];


                // best Class is weekend_hour fallback to weekend day
                if(typeof class_weekend.subclasses["c"+weekend] !== "undefined") {

                    if(typeof class_weekend.subclasses["c"+weekend].hour["c"+hour] !== "undefined") {
                        power += mean(class_weekend.subclasses["c"+weekend].hour["c"+hour]);
                        cnt++;
                        srcs.push("weekend_hour");
                    } else if(typeof class_weekend.subclasses["c"+weekend].day["c"+day] !== "undefined") {
                        power += mean(class_weekend.subclasses["c"+weekend].day["c"+day]);
                        cnt++;
                        srcs.push("weekend_day");
                    }
                    if(cnt === 0) {
                        power += class_weekend.stats.mean;
                        cnt++;
                        srcs.push("weekend_stats");
                    }

                } else {
                    if(typeof class_hour["c"+hour] !== "undefined") {
                        power += mean(class_hour["c"+hour]);
                        cnt ++;
                        srcs.push("hour");
                    } else if(typeof class_day["c"+day] !== "undefined") {
                        power += mean(class_day["c"+day]);
                        cnt ++;
                        srcs.push("day");
                    } else if(typeof class_weekend["c"+weekend] !== "undefined") {
                        power += mean(class_hour["c"+weekend]);
                        cnt ++;
                        srcs.push("weekend");
                    } else {
                        power += class_hour.stats.mean;
                        cnt ++;
                        srcs.push("hour_stats");
                    }
                }
                energy_reading += power;

                let prediction = {
                    time: new Date(ts),
                    mean: power,
                    energy: energy_reading,
                    srcs: srcs
                };

                predictions.push(prediction);
                ts+=3600000;
              }
                msg.payload = predictions;
                let batch = [];
                let measurement = ''
                if((typeof config.name !== 'undefined') && (config.name !== null)) {
                  measurement = config.name+"_prediction";
                } else {
                  measurement = node.id+"_prediction";
                }

                for(let i=0;i<predictions.length;i++) {
                  batch.push({
                    measurement: measurement,
                    fields: {
                      power: predictions[i].mean,
                      energy: predictions[i].energy
                    },
                    timestamp: new Date(predictions[i].time).getTime() * 1000000
                  });
                }

                node.send([msg,{payload:batch}]);

        });

    }
    RED.nodes.registerType("loadprediction",LoadPredictionNode);
}
