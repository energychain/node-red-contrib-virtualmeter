# node-red-contrib-virtualmeter

![Hex.pm](https://img.shields.io/hexpm/l/node-red-contrib-virtualmeter)
![npm](https://img.shields.io/npm/dw/node-red-contrib-virtualmeter)


Node-RED based Virtual Power Meter Node to be used within Corrently Ecosystem (German Electricity Grid).

## Installation
```bash
cd ~/.node-red
npm install --save node-red-contrib-virtualmeter
node-red-restart
```

## Use Cases
- You have only a power value and need a energy meter (reading)
- You have a meter reading and you need the actual power
- You have a consumption over time and need a meter (total energy)
- You have one of those items and need CO2 footprint


## Usage
Add virtualmeter node to your node-red flow and connect data source to input. Use input values as of following list to have a *managed* (virtual)meter for electricity.

You might have a look at the sample flows to get an overview of existing  

### Input Values
If <code>msg.payload</code> is number, than this number will be interpreted as Watt hours (Wh) to be added to meter reading.

If <code>msg.payload.energy</code> exists this will be used as new meter reading in Watt hours (Wh)

If <code>msg.payload.power</code> exists this will be used as average power (Watt) since last message

If <code>msg.payload.power_mw</code> exists this will be used as average power (Milli Watt) since last message

## Example

### Use with TP Link Kasa HS 110 Smart plug
```javascript
[{"id":"3102f4c5.b60a7c","type":"tab","label":"Sample Flow - TP Link HS 110","disabled":false,"info":"Use Virtual Meter On Top of TP Link HS110 Smart Plug meter."},{"id":"bf814178.8ccf9","type":"virtualmeter","z":"3102f4c5.b60a7c","zip":"69256","name":null,"energypricein":0,"energypriceout":0,"x":850,"y":140,"wires":[[],[],[],[]]},{"id":"b3db7484.5dd808","type":"smart-plug","z":"3102f4c5.b60a7c","name":"My Plug","device":"192.168.192.39","interval":10000,"eventInterval":1000,"x":660,"y":140,"wires":[["bf814178.8ccf9"]]},{"id":"888ddfd8.a5484","type":"function","z":"3102f4c5.b60a7c","name":"getMeterInfo","func":"msg.payload=\"getMeterInfo\";\nreturn msg;","outputs":1,"noerr":0,"x":450,"y":140,"wires":[["b3db7484.5dd808"]]},{"id":"79ea072c.2822e8","type":"inject","z":"3102f4c5.b60a7c","name":"","topic":"","payload":"","payloadType":"date","repeat":"","crontab":"","once":false,"onceDelay":0.1,"x":240,"y":140,"wires":[["888ddfd8.a5484"]]}]
```


## Meta
Released by STROMDAO GmbH, Gerhard Weiser Ring 29, 69256 Mauer

Corrently Ecosystem (https://www.corrently.de/)

Distributed under the Apache-2.0 license. See [LICENSE] for more information.
