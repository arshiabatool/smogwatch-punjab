1\.	Negative or missing PM2.5 is treated as missing.

2\.	PM2.5 above 1,000 micrograms per cubic metre is treated as a sensor or model error and set to missing.

3\.	Gaps of up to 3 hours in a city's series are filled by straight-line interpolation. Longer gaps stay empty.

4\.	A station reading older than 3 hours is ignored (it is stale).

5\.	If a city has a fresh station reading, the page shows it as Measured; otherwise it shows the model value as Modelled estimate.



