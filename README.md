# node-red-contrib-virtualmeter

![Hex.pm](https://img.shields.io/hexpm/l/node-red-contrib-virtualmeter)
![npm](https://img.shields.io/npm/dw/node-red-contrib-virtualmeter)


Node-RED based Virtual Power Meter Node to be used within Corrently Ecosystem (German Electricity Grid).

## Use Cases
- You have only a power value and need a energy meter (reading)
- You have a meter reading and you need the actual power
- You have a consumption over time and need a meter (total energy)
- You have one of those items and need CO2 footprint


## Usage
Add virtualmeter node to your node-red flow and connect data source to input. Use input values as of following list to have a //managed// (virtual)meter for electricity.

You might have a look at the sample flows to get an overview of existing  

### Input Values
If <code>msg.payload</code> is number, than this number will be interpreted as Watt hours (Wh) to be added to meter reading.

If <code>msg.payload.energy</code> exists this will be used as new meter reading in Watt hours (Wh)

If <code>msg.payload.power</code> exists this will be used as average power (Watt) since last message
If <code>msg.payload.power_mw</code> exists this will be used as average power (Milli Watt) since last message


## Meta
Released by STROMDAO GmbH, Gerhard Weiser Ring 29, 69256 Mauer

Corrently Ecosystem (https://www.corrently.de/)

Distributed under the Apache-2.0 license. See [LICENSE] for more information.
