const _ = require("lodash");

module.exports = function(RED) {

    function SimpleGSINode(config) {
        RED.nodes.createNode(this,config);

        var node = this;
        node.on('input', async function(msg) {
          let saldo = msg.payload;
          let min = 9999999999;
          let max = -999999999999;

          for(let i=0; i<saldo.length;i++) {
              saldo[i].measurement = config.name;
              if(saldo[i].fields.power > max) max = saldo[i].fields.power;
              if(saldo[i].fields.power < min) min = saldo[i].fields.power;
          }

          let delta = max - min;

          let gsi_sum = 0;
          let gsi_cnt = 0;

          for(let i=0; i<saldo.length;i++) {
              saldo[i].fields.gsi = 100-(((saldo[i].fields.power  - min) / delta)*100);
              gsi_cnt++;
              gsi_sum += saldo[i].fields.gsi;
          }

          let gsi_mean = gsi_sum / gsi_cnt;
          let mean_scale = 50-gsi_mean;


          for(let i=0; i<saldo.length;i++) {
              saldo[i].fields.gsi = 100 - ((saldo[i].fields.gsi*((100-mean_scale)/100) ) + mean_scale);
          }

          msg.payload = saldo;

          node.send(msg);
        });
    }
    RED.nodes.registerType("simplegsi",SimpleGSINode);
}
