# MapAction Dissertation 

## Overview

In collaboration with UCL and MapAction, this dissertation investigates the impacts of flooding on food security through applied machine learning and remote sensing data. 

## Abstract

As global temperatures rise, floods and droughts are expected to increase, particularly in regions suffering from acute food insecurity, such as Asia and Africa. To adequately respond to these crises, humanitarian actors need a better understanding of the relationship between flooding and food security. While past research has applied new technologies to better quantify both food security and flooding events, the intersection between these two phenomena remains under-researched. This dissertation attempts to address this research gap and determine whether machine learning and remote sensing technologies can adequately capture the relationship between flooding and food security. Using Burkina Faso, Mali, and Niger as case studies, the project combined food security data with remotely sensed flooding data extracted from Google Earth Engine, which was then fed into a Random Forest algorithm. Particular attention was given to quantifying any spatial-temporal autocorrelations in the data, which was sourced at the district level over 1 month time intervals. Despite poor model outputs (~82% accuracy rates), the paper provides a foundation from which future research can build upon to better understand how flooding events impact food security.

## File Descriptions
1. [STDA Pre-processing]( https://github.com/Claudia-Offner/MapActionDissertation/blob/master/STDA_preprocessing.ipynb): Data cleaning and pre-processing required for the spatial-temporal data analysis (STDA).

2. [STDA]( https://github.com/Claudia-Offner/MapActionDissertation/blob/master/1%20-%20STDA.ipynb): A STDA specifically investigates spatial-temporal dependencies within a dataset whilst also providing a comprehensive descriptive analysis of the data at hand. Since this data will be used in predictions specific to both space and time, this step is necessary to produce space time lags that effectively quantify spatial-temporal dependencies within subsequent models.

3. [Flood Pre-processing]( https://github.com/Claudia-Offner/MapActionDissertation/blob/master/2a%20-%20Flood_preprocessing.ipynb): Data cleaning and pre-processing required for data to be fed into Google Earth Engine (GEE). 

4. [Flood GEE Model]( https://github.com/Claudia-Offner/MapActionDissertation/blob/master/2b%20-%20Flood_GEE.js): This file gives the code used to manually extract flooding data from google earth engine (GEE). This is necessary to quantify changes in water surface area before and after a flooding event. Code here is written in JavaScript API and is meant to be run in the GEE code editor interface. 

5. [Flood Post-processing]( https://github.com/Claudia-Offner/MapActionDissertation/blob/master/2c%20-%20Flood_postprocessing.ipynb): Code used to merge FS data with manually extracted GE data. Includes a Point-in-Polygon (PIP) test to align district geometries. 

6. [ML Food Classifier]( https://github.com/Claudia-Offner/MapActionDissertation/blob/master/3%20-%20ML_food_classifier.ipynb): This file runs the code needed to test the research hypothesis. To forecast whether the FS improves, remains the same, or deteriorates in response to floods, a Random Forest (RF) classification algorithm is implemented.

## Results
The results do confirm the study hypothesis and demonstrate that ML models can predict a variety of FS classifications from RS images of flooding to some extent. While the quality of these classifications is still in question, there are several promising research opportunities that can be taken to elaborate upon this topic. The aim of this paper was to determine whether ML and RS technologies capture the relationship between flooding and food security well enough to perform predictions and be of practical use to MapAction. Ultimately the study accomplished laying a foundation for this intersection of research, from which humanitarian actors can build upon to strengthen their disaster response effort. Looking forward, this project hops to encourage further research on forecasting the ways in which  natural disasters impact the spatial distribution of food security for a country. 

