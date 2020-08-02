const _ = require("lodash");

module.exports = function(RED) {
    let Influx = require('influx');


    function PVPredictionNode(config) {
        RED.nodes.createNode(this,config);

        this.influxdbConfig = RED.nodes.getNode(config.influxdb);

        this.client =  this.influxdbConfig.client;
        var node = this;

        node.on('input', async function(msg) {

          let query = 'SELECT mean("esolar") FROM "'+config.gsisolar+'" WHERE time>now()-7d GROUP BY time(1h) fill(previous)';
          let results = await node.client.query(query, {});
          let cleaned = [];
          let class_hour = {};

          for(let i=0;i<results.length;i++) {
              if(results[i].mean !== null) {
                  let date = new Date(results[i].time);
                  results[i].hour = date.getHours();
                  cleaned.push(results[i]);
            }
          }

          const mean = function(aobj) {
              let sum = 0;
              let cnt = 0;
              let min=9999;
              let max=-9999;
              for(let i=0;i<aobj.length;i++) {
                  if(min > aobj[i].mean) min = aobj[i].mean;
                  if(max < aobj[i].mean) max = aobj[i].mean;
                  sum += aobj[i].mean;
                  cnt++;
              }
              return {mean: sum/cnt, min:min,max:max};
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
          }

          classStats(class_hour);
          let energy_reading = 0;
          let energy_request = await node.client.query('select last("energy") from '+config.name,{});
          if(energy_request.length > 0) {
            energy_reading = energy_request[0].last;
          }
          query = 'SELECT mean("power") FROM "'+config.name+'" WHERE time>now()-7d GROUP BY time(1h) fill(previous)';
          results = await node.client.query(query, {});
          cleaned = [];
          class_generation = {};

          for(let i=0;i<results.length;i++) {
              if(results[i].mean !== null) {
                  let date = new Date(results[i].time);
                  results[i].hour = date.getHours();
                  cleaned.push(results[i]);
            }
          }

          for(let i=0; i<cleaned.length;i++) {
              classify(class_generation,cleaned[i],'hour');
          }

          classStats(class_generation);

          class_hour.subclasses = {};
          // Build SubClassification (Merged)
          for(let c in class_hour) {

            if(c !== "stats") {
                let class_hour_generation = {};
                class_hour.subclasses[c] = {};
                // Gehe die Generation in der Prognosestunde durch und schaue, welche Werte wir da haben
                if(typeof class_generation[c] !== "undefined") {
                    class_hour_generation.power = mean(class_generation[c]);
                    class_hour_generation.gsi = mean(class_hour[c]);
                }


                class_hour.subclasses[c].generation = class_hour_generation;
            }
          }

          // Generate simple prediction
          query = 'SELECT mean("esolar") FROM '+config.gsisolar+' where time<now()+72h and time>now() GROUP BY time(1h) fill(linear)';
          results = await node.client.query(query, {});
          let predictions = [];
          for(let i=0;i<results.length;i++) {
                let date = new Date(results[i].time);
                date.setMinutes(0);
                date.setSeconds(0);
                date.setMilliseconds(0);
                let ts = date.getTime();
                let hour = new Date(ts).getHours();

                let power =0;
                let gsi = results[i].mean;
                let history = class_hour.subclasses["c"+hour].generation;
                let srcs = [];
                if(history.gsi.min > gsi) {
                    power = history.power.min;
                    srcs.push("min");
                } else
                if(history.gsi.max < gsi) {
                    power = history.power.max;
                    srcs.push("max");
                } else {
                  // Skalieren zwischen min und max

                  let delta_gsi_history = history.gsi.max - history.gsi.min;
                  let delta_gsi_min = gsi - history.gsi.min;

                  if(delta_gsi_history == 0) {
                    power = history.power.min;
                    srcs.push("mean_min");
                  } else {
                    let factor = delta_gsi_min / delta_gsi_history;
                    power = history.power.min + ((history.power.max - history.power.min) * factor);
                    srcs.push("mean");
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
          }

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


          msg.payload = {gsi:class_hour,generation:class_generation,predictions:predictions};
          node.send([msg,{payload:batch}]);
        });
    }
    RED.nodes.registerType("pvprediction",PVPredictionNode);
}
