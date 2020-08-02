const _ = require("lodash");

module.exports = function(RED) {
    let Influx = require('influx');

    function SumPredictionNode(config) {
        RED.nodes.createNode(this,config);
        this.influxdbConfig = RED.nodes.getNode(config.influxdb);

        this.client =  this.influxdbConfig.client;
        var node = this;
        node.on('input', async function(msg) {
          let points = [];
          let date = new Date();
          date.setMinutes(0);
          date.setSeconds(0);
          date.setMilliseconds(0);
          let ts = date.getTime();

          for(let i=0;i<72;i++) {
              let point = {};
              let query = 'select mean(power) from e0generation_prediction where time>='+ts+'000000 and time<='+(ts+3600000)+'000000 GROUP BY time(1h) fill(linear)';
              let results = await node.client.query(query, {});
              if(results.length >0) {
                  let generation = results[0].mean;
                  query = 'select mean(power) from e0consumption_prediction where time>='+ts+'000000 and time<='+(ts+3600000)+'000000 GROUP BY time(1h) fill(linear)';
                  results = await node.client.query(query, {});
                  if(results.length > 0) {
                    let consumption = results[0].mean;
                    let measurement = ''
                    if((typeof config.name !== 'undefined') && (config.name !== null)) {
                      measurement = config.name+"_prediction";
                    } else {
                      measurement = node.id+"_prediction";
                    }
                    point.measurement = measurement;
                    point.fields = {
                      power: consumption+generation
                    }
                    point.timestamp = ts*1000000;
                    points.push(point);
                  }
              }
              ts += 3600000;
          }
          msg.payload = points;
          node.send(msg);
        });
    }
    RED.nodes.registerType("sumprediction",SumPredictionNode);
}
