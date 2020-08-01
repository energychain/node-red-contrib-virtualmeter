const _ = require("lodash");

module.exports = function(RED) {
    function SumMeterNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.on('input', function(msg) {
            let ts = new Date().getTime();
            if(typeof msg.meterId !== "undefined") {
              let instance = _.clone(msg);
              delete instance.meterId;
              delete instance.payload;
              node.context().set(msg.meterId,instance);
            }

            // build sum
            let meterIds = node.context().keys();
            tmp_msg = {
              energy: 0,
              power: 0,
              energy_in: 0,
              energy_out: 0,
              energy_in_co2: 0,
              energy_out_co2:  0,
              energy_cost_in: 0,
              energy_cost_out: 0,
              timeStamp: ts,
              meterId: (node.id).replace('.','_')
            }

            for(let i=0;i<meterIds.length;i++) {
              let multipl = 1;
              if(node.context().get(meterIds[i]).consumption) multipl = -1;

              tmp_msg.energy += node.context().get(meterIds[i]).energy * multipl;
              tmp_msg.power += node.context().get(meterIds[i]).power * multipl;
              tmp_msg.energy_in += node.context().get(meterIds[i]).energy_in * multipl;
              tmp_msg.energy_out += node.context().get(meterIds[i]).energy_out * multipl;
              if(!isNaN(node.context().get(meterIds[i]).energy_in_co2)) tmp_msg.energy_in_co2 += node.context().get(meterIds[i]).energy_in_co2 * multipl;
              if(!isNaN(node.context().get(meterIds[i]).energy_out_co2)) tmp_msg.energy_out_co2 += node.context().get(meterIds[i]).energy_out_co2 * multipl;
              tmp_msg.energy_cost_in += node.context().get(meterIds[i]).energy_cost_in * multipl;
              tmp_msg.energy_cost_out += node.context().get(meterIds[i]).energy_cost_out * multipl;
            }
            let msgs = [];

            let msg1 = _.clone(tmp_msg);
            msg1.payload = tmp_msg.energy;
            msg1.topic = 'Energy';
            msgs.push(msg1);

            let msg2 = _.clone(tmp_msg);
            msg2.payload = tmp_msg.power;
            msg2.topic = 'Power';
            msgs.push(msg2);

            let msg3 = _.clone(tmp_msg);
            msg3.payload = tmp_msg.energy_out_co2;
            msg3.topic = 'CO2';
            msgs.push(msg3);

            // Handle Output for InfluxDB Batch Nodes
            let msg4 = _.clone(tmp_msg);
            let point = {};
            let payload = [];
            if((typeof config.name !== 'undefined') && (config.name !== null)) {
              point.measurement = config.name;
            } else {
              point.measurement = "SumMeter"+node.id;
            }
            point.fields = {
              energy:   tmp_msg.energy,
              power:   tmp_msg.power,
              energy_in:   tmp_msg.energy_in,
              energy_out: tmp_msg.energy_out,
              energy_cost_in: tmp_msg.energy_cost_in,
              energy_cost_out: tmp_msg.energy_cost_out,
              energy_in_co2:   tmp_msg.energy_in_co2,
              energy_out_co2:  tmp_msg.energy_out_co2
            }


            point.timestamp = (ts * 1000000) ;
            payload.push(point);
            msg4.payload = payload;
            msg4.topic = 'InfluxDB';
            msgs.push(msg4);
            node.status({text:"Power: "+Math.round(tmp_msg.power)+"W  Energy:"+ Math.round(tmp_msg.energy) +" Wh"});
            node.context().set("energy_in",tmp_msg.energy_in);
            node.context().set("energy_out",tmp_msg.energy_out);
            node.context().set("energy_cost_in",tmp_msg.energy_cost_in);
            node.context().set("energy_cost_out",tmp_msg.energy_cost_out);
            node.context().set("power",power);
            node.context().set("updated", ts);

            node.send(msgs);

        });
    }
    RED.nodes.registerType("summeter",SumMeterNode);
}
