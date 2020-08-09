const axios = require("axios");
const qs = require("querystring");
const _ = require("lodash");

module.exports = function(RED) {
    function VirtualMeterNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.on('input', function(msg) {
            let ts = new Date().getTime();
            let energy = node.context().get("energy");
            let power = node.context().get("power");
            let updated = node.context().get("updated");

            let energy_in = node.context().get("energy_in");
            let energy_out = node.context().get("energy_out");

            let energy_cost_in = node.context().get("energy_cost_in");
            let energy_cost_out = node.context().get("energy_cost_out");

            if(isNaN(energy)) energy = 0;
            let energy_new = energy;

            if(isNaN(energy_in)) energy_in = 0;
            if(isNaN(energy_out)) energy_out = 0;
            if(isNaN(energy_cost_in)) energy_cost_in = 0;
            if(isNaN(energy_cost_out)) energy_cost_out = 0;
            if(isNaN(power)) power = 0;


            if(isNaN(updated)) {
              updated = ts;
              node.context().set("first_reading",ts);
            } else {
                // Wrapper for TP Link Kasa
                if(typeof msg.payload.power_mw !== "undefined") {
                    msg.payload.power = Math.round(msg.payload.power_mw / 1000);
                }

                // Wrapper for Discovergy Meter (see sample flow!)
                if(typeof msg.payload["1.8.0"] !== "undefined") {
                  msg.payload.energy = msg.payload["1.8.0"];
                }

                if(typeof msg.payload.energy !== "undefined") {
                  power = (msg.payload.energy - energy) / (3600000/(ts - updated));
                  energy_new = msg.payload.energy;
                } else
                if(typeof msg.payload.power !== "undefined") {
                  power = msg.payload.power;
                  energy_new += (msg.payload.power / (3600000/(ts - updated)));
               } else {
                energy_new += 1 * msg.payload;
                if(updated > 0) {
                  power = Math.round(msg.payload / ((ts - updated)/3600000));
                }
              }
              if(power > 0) {
                  energy_out += Math.abs(energy-energy_new);
              } else {
                energy_in += Math.abs(energy-energy_new);
              }
            }

            node.context().set("energy",energy_new);

            const storeReading = async function(identifier,energy) {
                let data = {
                  "1.8.0": Math.abs(Math.round(energy)),
                  "externalAccount": node.id + "_" + node.z + "_" + identifier,
                  "secret": node.z,
                  "zip": config.zip
                }
                let result = await axios.post("https://api.corrently.io/core/reading",
                                  qs.stringify(data),
                                  {
                                    headers: {
                                            'Content-Type': 'application/x-www-form-urlencoded'
                                             }
                                  }
                          );
                node.context().set(identifier+"_account",result.data.account);
                node.context().set(identifier+"_1_8_1",result.data["1.8.1"]);
                node.context().set(identifier+"_1_8_0",result.data["1.8.0"]);
                node.context().set(identifier+"_1_8_2",result.data["1.8.2"]);
                node.context().set(identifier+"_9_99_0",result.data["9.99.0"]);
                node.context().set(identifier+"_co2",result.data["co2_g_oekostrom"]);
            }
            if(config.zip.length == 5) {
              if(energy_in > node.context().get("energy_in")) {
                  if(config.energypricein > 0) {
                      let delta = energy_in - node.context().get("energy_in");
                      energy_cost_in += (delta/1000) * config.energypricein;
                  }
                  storeReading("energy_in",energy_in);
              }
              if(energy_out > node.context().get("energy_out")) {
                  if(config.energypriceout > 0) {
                      let delta = energy_out - node.context().get("energy_out");
                      energy_cost_out += (delta/1000) * config.energypriceout;
                  }
                  storeReading("energy_out",energy_out);
              }
            }
            node.context().set("energy_in",energy_in);
            node.context().set("energy_out",energy_out);
            node.context().set("energy_cost_in",energy_cost_in);
            node.context().set("energy_cost_out",energy_cost_out);
            node.context().set("power",power);
            node.context().set("updated", ts);
            node.status({text:"Power: "+Math.round(power)+"W  Energy:"+ Math.round(energy_new) +" Wh"});

            // Prepare Outputs
            let msgs = [];
            let tmp_msg = {
              energy: energy_new,
              power: power,
              energy_in: energy_in,
              energy_out: energy_out,
              energy_in_co2: node.context().get('energy_in_co2'),
              energy_out_co2:  node.context().get('energy_out_co2'),
              energy_cost_in: energy_cost_in,
              energy_cost_out: energy_cost_out,
              account_in: node.context().get('energy_in_account'),
              account_out: node.context().get('energy_out_account'),
              gsi:node.context().get("energy_in_9_99_0"),
              zip: config.zip,
              timeStamp: ts,
              name: config.name,
              consumption: config.isconsumption,
              meterId: (node.id).replace('.','_')
            }

            if(config.ishybrid) {
              if(tmp_msg.power < 0) {
                  tmp_msg.consumption = false;
              } else {
                  tmp_msg.consumption = true;
              }
            }


            let msg1 = _.clone(tmp_msg);
            msg1.payload = tmp_msg.energy;
            msg1.topic = 'Energy';
            msgs.push(msg1);

            let msg2 = _.clone(tmp_msg);
            msg2.payload = tmp_msg.power;
            msg2.topic = 'Power';
            msgs.push(msg2);

            let msg3 = _.clone(tmp_msg);
            msg3.payload = node.context().get('energy_out_co2');
            msg3.topic = 'CO2';
            msgs.push(msg3);

            // Handle Output for InfluxDB Batch Nodes
            let msg4 = _.clone(tmp_msg);
            let point = {};
            let payload = [];
            if((typeof config.name !== 'undefined') && (config.name !== null)) {
              point.measurement = config.name;
            } else {
              point.measurement = "VirutalMeter"+node.id;
            }
            point.fields = {
              energy: energy_new,
              power: power,
              energy_in: energy_in,
              energy_out: energy_out,
              energy_cost_in: energy_cost_in,
              energy_cost_out: energy_cost_out,
              energy_in_co2: node.context().get('energy_in_co2'),
              energy_out_co2:  node.context().get('energy_out_co2'),
              gsi:node.context().get("energy_in_9_99_0")
            }
            if(typeof point.fields.energy_in_co2 === "undefined") delete point.fields.energy_in_co2;
            if(typeof point.fields.energy_out_co2 === "undefined") delete point.fields.energy_out_co2;
            if(typeof point.fields.gsi === "undefined") delete point.fields.gsi;

            point.timestamp = (ts * 1000000) ;
            payload.push(point);
            msg4.payload = payload;
            msg4.topic = 'InfluxDB';
            msgs.push(msg4);

            node.send(msgs);

        });
    }
    RED.nodes.registerType("virtualmeter",VirtualMeterNode);
}
