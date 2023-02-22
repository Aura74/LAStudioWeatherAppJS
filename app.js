window.onload = function () {
  datumIDag(), getLocation(), displayFavoritOrt(), andraSattet();
}

// *************************************** Dagens Datum för Gävle och annan vald stad ************************************************
function datumIDag() {
  const today = new Date();// sparar nytt datum funktionen i en variabel, today
  const date = document.querySelector(".date");// lägger elemetet med classen date i en variabel och kallar den för date
  date.innerText = dateFunction(today);// här skrivs dagens datum från today(kommer från new Date()) in i dates innerText vilket är i elementete med classen date, detta hämtas inte från api utan från datorn själv och min programering längre ner

  function dateFunction(d) {// ger det en paramerer d, kan vara vad som helst
    let months = ["Januari", "Februari", "Mars", "Aprl", "Maj", "Juni", "Juli", "Augusti", "September", "Oktober", "November", "December"];
    let days = ["Söndagen", "Måndagen", "Tisdagen", "Onsdagen", "Torsdagen", "Fredagen", "Lördagen"];
    let day = days[d.getDay()];// Date.prototype.getDay(), The getDay() method returns the day of the week for the specified date according to local time, where 0 represents Sunday. For the day of the month, see Date.prototype.getDate().
    let date = d.getDate();// Date.prototype.getDate(), The getDate() method returns the day of the month for the specified date according to local time.
    let month = months[d.getMonth()];// Date.prototype.getMonth() metoden , The getMonth() method returns the month in the specified date according to local time, as a zero-based value (where zero indicates the first month of the year).
    let year = d.getFullYear();// Date.prototype.getFullYear() The getFullYear() method returns the year of the specified date according to local time.
    let tidTimmar = d.getHours(); // timmar
    let tidMin = d.toTimeString().slice(3, 5); // miuter, för att få ex 05 min iställer för 5 abvänds .slice(3, 5);
    return `Idag - ${day}\n Den ${date} ${month} \n Klockan: ${tidTimmar}:${tidMin} \n År: ${year} `; // ger ett svar/return på exempelvis Torsdag, 16 Sept 2021
  }
}

//******************************************************** VÄDER ************************************************************************

function GetInfo() {
  let namnPaStaden = document.getElementById("vilkenStadInput");  // den som var från början SÖK rutan
  let ortsName = document.getElementById("ortsName"); // h2 dolda 5 dagars
  ortsName.innerHTML = namnPaStaden.value;

  fetch('https://api.openweathermap.org/data/2.5/forecast?q=' + namnPaStaden.value + '&appid=32ba0bfed592484379e51106cef3f204')
    .then(response => response.json())
    .then(data => {

      console.log(data)
      // Första sidan max min temp    // toFixed(1) vill bara ha en decimal
      document.getElementById("tempLAMaxOMin").innerHTML = "Min: " + Math.round(data.list[0].main.temp_min - 273.15) + "°C" + " / Max: " + Math.round(data.list[0].main.temp_max - 273.15) + "°C";
      // Temp just nu
      document.getElementById("tempLAJustNu").innerHTML = "Temperatur: " + Math.round(data.list[0].main.temp - 273.15) + "°C";
      // Moln
      document.getElementById("molnLA").innerHTML = "Väder: " + data.list[0].weather[0].main;
      // cityLA ORT
      document.getElementById("cityLA").innerHTML = "Ort: " + data.city.name + ", " + data.city.country;
      // Datum 
      document.getElementById("datum1").innerHTML = data.list[7].dt_txt.slice(0, 10);
      document.getElementById("datum2").innerHTML = data.list[15].dt_txt.slice(0, 10);
      document.getElementById("datum3").innerHTML = data.list[23].dt_txt.slice(0, 10);
      document.getElementById("datum4").innerHTML = data.list[31].dt_txt.slice(0, 10);
      document.getElementById("datum5").innerHTML = data.list[39].dt_txt.slice(0, 10);
      // max och min
      document.getElementById("day1Min").innerHTML = "Min: " + Number(data.list[1].main.temp_min - 273.15).toFixed(0) + "°C";// får temp i kelvin dra av 273 
      document.getElementById("day1Max").innerHTML = "Max: " + Number(data.list[6].main.temp_max - 273.15).toFixed(0) + "°C";
      document.getElementById("day2Min").innerHTML = "Min: " + Number(data.list[11].main.temp_min - 273.15).toFixed(0) + "°C";
      document.getElementById("day2Max").innerHTML = "Max: " + Number(data.list[14].main.temp_max - 273.15).toFixed(0) + "°C";
      document.getElementById("day3Min").innerHTML = "Min: " + Number(data.list[19].main.temp_min - 273.15).toFixed(0) + "°C";
      document.getElementById("day3Max").innerHTML = "Max: " + Number(data.list[22].main.temp_max - 273.15).toFixed(0) + "°C";
      document.getElementById("day4Min").innerHTML = "Min: " + Number(data.list[26].main.temp_min - 273.15).toFixed(0) + "°C";
      document.getElementById("day4Max").innerHTML = "Max: " + Number(data.list[30].main.temp_max - 273.15).toFixed(0) + "°C";
      document.getElementById("day5Min").innerHTML = "Min: " + Number(data.list[34].main.temp_min - 273.15).toFixed(0) + "°C";
      document.getElementById("day5Max").innerHTML = "Max: " + Number(data.list[38].main.temp_max - 273.15).toFixed(0) + "°C";
      // Iconen
      document.getElementById("img0").src = "http://openweathermap.org/img/wn/" + data.list[0].weather[0].icon + "@2x.png";
      document.getElementById("img1").src = "http://openweathermap.org/img/wn/" + data.list[7].weather[0].icon + "@2x.png";
      document.getElementById("img2").src = "http://openweathermap.org/img/wn/" + data.list[15].weather[0].icon + "@2x.png";
      document.getElementById("img3").src = "http://openweathermap.org/img/wn/" + data.list[23].weather[0].icon + "@2x.png";
      document.getElementById("img4").src = "http://openweathermap.org/img/wn/" + data.list[31].weather[0].icon + "@2x.png";
      document.getElementById("img5").src = "http://openweathermap.org/img/wn/" + data.list[39].weather[0].icon + "@2x.png";

      overstaRubriken.innerHTML = namnPaStaden.value;
    })
}
// Deafult Gävle start
function startEllerUppdatera() {
  document.getElementById("vilkenStadInput").defaultValue = "Gävle";
  GetInfo();
}
//Veckodagar
var d = new Date();
var veckodag = ["Måndag", "Tisdag", "Onsdag", "Torsdag", "Fredag", "Lördag", "Söndag"];

//rätt integer för dage
function CheckDay(day) {
  if (day + d.getDay() > 6) {
    return day + d.getDay() - 7;
  }
  else {
    return day + d.getDay();
  }
}
// veckodagen för 5-dagars
document.getElementById("day1").innerHTML = veckodag[CheckDay(0)];
document.getElementById("day2").innerHTML = veckodag[CheckDay(1)];
document.getElementById("day3").innerHTML = veckodag[CheckDay(2)];
document.getElementById("day4").innerHTML = veckodag[CheckDay(3)];
document.getElementById("day5").innerHTML = veckodag[CheckDay(4)];

// Döljer 5 dagars prognos
function trogglaFunction() {
  let element = document.getElementById("doldDiv");
  element.classList.remove("dold");
  element.classList.toggle("main-container3");

  let element2 = document.getElementById("doldDiv2");
  element2.classList.toggle("colorMain5");

  let element3 = document.getElementById("weatherContainer");
  element3.classList.toggle("container");
}

// resetra rutan sök rutan
function resetSearchField() {
  const searchKnapp = document.querySelector(".search");
  searchKnapp.value = ""; // nollställer sökrutan till tom 
}

// ************************************* PLATS *****************************************************************************

const x = document.getElementById("apiAlla");
const positionHtml = document.querySelector(".positions-data")
const overstaRubriken = document.querySelector(".rubriken")  // översta rukriken vilkenStadInput
const textTillvilkenStadInput = document.querySelector("#vilkenStadInputn")

function getLocation() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(showPosition);
  } else {
    x.innerHTML = "Geolocation is not supported by this browser.";
  }
}

function showPosition(position) {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  const accuracy = position.coords.accuracy;

  const api = `http://api.openweathermap.org/geo/1.0/reverse?lat=${lat}&lon=${lon}&units=metric&appid=32ba0bfed592484379e51106cef3f204`;

  fetch(api).then(res => {
    return res.json();
  }).then(data => {
    appendData(data);

  }).catch(err => {
    console.log(err)
  })
  overstaRubriken.innerHTML = `Din position`;
}

const appendData = (data) => {
  const name = data[0].name;
  document.getElementById("vilkenStadInput").defaultValue = name;
  document.getElementById("cityLA").innerHTML = name;
  GetInfo()
}

// Min canvas
var canvas = document.getElementById("myCanvas");
var ctx = canvas.getContext("2d");
ctx.font = "30px Comic Sans MS";
ctx.fillStyle = "yellow";
ctx.textAlign = "center";
ctx.fillText("Mina Favoriter", canvas.width / 2, canvas.height / 1.1);
ctx.fillStyle = "yellow";
ctx.fillRect(0, 0, 250, 10);

// local storage - delen ************************************************************************************************************************

const input = document.querySelector("#vilkenStadInput"),
  btn = document.querySelector("#favoritButtonAdd"),
  listanMedFavoritOrterna = document.querySelector(".sparadeFavoriter"),
  clear = document.querySelector(".clear");

let lagratNamnOrt;

btn.addEventListener("click", addFavoriterTillListan);

// GET - delen från local storage
function getFavoOrt() {
  if (localStorage.getItem("lagratNamnOrt") === null) {
    lagratNamnOrt = [];
  } else {
    lagratNamnOrt = JSON.parse(localStorage.getItem("lagratNamnOrt"));
  }
}

function addFavoriterTillListan() {
  if (input.value !== "") {
    addFavoriterTillListanToLS();
    listanMedFavoritOrterna.innerHTML = "";
    displayFavoritOrt();
  } else {
    alert("Fältet får ej lämnas tomt");
  }
}

//   Save - delen till local storage
function addFavoriterTillListanToLS() {
  getFavoOrt();
  lagratNamnOrt.push(input.value);
  localStorage.setItem("lagratNamnOrt", JSON.stringify(lagratNamnOrt));
  input.value = "";
}

// Visa på skärmen
function displayFavoritOrt() {
  getFavoOrt();

  lagratNamnOrt.forEach((task, index) => {
    const newLi = document.createElement("li");
    const raderarKnapp = document.createElement("button");
    raderarKnapp.classList.add("denRodaKnappenSomRaderar");
    raderarKnapp.setAttribute("style", "background-color: red;");
    raderarKnapp.innerHTML = `<i class="fas fa-trash-alt" id="${index}" onclick="deleteaFavoritOrt(this.id)"></i> `;
    newLi.appendChild(document.createTextNode(task));
    newLi.appendChild(raderarKnapp);
    listanMedFavoritOrterna.appendChild(newLi);
  });
}

// Ta bort ena favoriten
function deleteaFavoritOrt(index) {
  const del = confirm("Är du säker på att du ska ta bort din favoritort");
  if (del == true) {
    getFavoOrt();
  }

  lagratNamnOrt.splice(index, 1);
  localStorage.setItem("lagratNamnOrt", JSON.stringify(lagratNamnOrt));
  listanMedFavoritOrterna.innerHTML = "";
  displayFavoritOrt();
}

// Ta bort alla
clear.addEventListener("click", clearlagratNamnOrt);

function clearlagratNamnOrt() {
  const dellagratNamnOrt = confirm("Ta bort alla favoriter");

  if (dellagratNamnOrt == true) {
    localStorage.clear();
    listanMedFavoritOrterna.innerHTML = "";
    displayFavoritOrt();
  }
}

// Här visas i alla fall namnet
const lista = document.querySelector('.sparadeFavoriter');
lista.addEventListener('click', favortiListaFunktionen);

function favortiListaFunktionen(e) {
  var text = e.target.innerText

  let namnPaStaden = document.getElementById("vilkenStadInput");  // den som var från början SÖK rutan
  namnPaStaden.value = "";

  let ortsName = document.getElementById("ortsName"); // h2 dolda 5 dagars
  ortsName.innerHTML = text;

  fetch('https://api.openweathermap.org/data/2.5/forecast?q=' + text + '&appid=32ba0bfed592484379e51106cef3f204')
    .then(response => response.json())
    .then(data => {

      console.log(data)
      // Första sidan max min temp    // toFixed(1) vill bara ha en decimal
      document.getElementById("tempLAMaxOMin").innerHTML = "Min: " + Math.round(data.list[0].main.temp_min - 273.15) + "°C" + " / Max: " + Math.round(data.list[0].main.temp_max - 273.15) + "°C";
      // Temp just nu
      document.getElementById("tempLAJustNu").innerHTML = "Temperatur: " + Math.round(data.list[0].main.temp - 273.15) + "°C";
      // Moln
      document.getElementById("molnLA").innerHTML = "Väder: " + data.list[0].weather[0].main;
      // cityLA ORT
      document.getElementById("cityLA").innerHTML = "Ort: " + data.city.name + ", " + data.city.country;
      // Datum 
      document.getElementById("datum1").innerHTML = data.list[7].dt_txt.slice(0, 10);
      document.getElementById("datum2").innerHTML = data.list[15].dt_txt.slice(0, 10);
      document.getElementById("datum3").innerHTML = data.list[23].dt_txt.slice(0, 10);
      document.getElementById("datum4").innerHTML = data.list[31].dt_txt.slice(0, 10);
      document.getElementById("datum5").innerHTML = data.list[39].dt_txt.slice(0, 10);
      // max och min
      document.getElementById("day1Min").innerHTML = "Min: " + Number(data.list[1].main.temp_min - 273.15).toFixed(0) + "°C";// får temp i kelvin dra av 273 
      document.getElementById("day1Max").innerHTML = "Max: " + Number(data.list[6].main.temp_max - 273.15).toFixed(0) + "°C";
      document.getElementById("day2Min").innerHTML = "Min: " + Number(data.list[11].main.temp_min - 273.15).toFixed(0) + "°C";
      document.getElementById("day2Max").innerHTML = "Max: " + Number(data.list[14].main.temp_max - 273.15).toFixed(0) + "°C";
      document.getElementById("day3Min").innerHTML = "Min: " + Number(data.list[19].main.temp_min - 273.15).toFixed(0) + "°C";
      document.getElementById("day3Max").innerHTML = "Max: " + Number(data.list[22].main.temp_max - 273.15).toFixed(0) + "°C";
      document.getElementById("day4Min").innerHTML = "Min: " + Number(data.list[26].main.temp_min - 273.15).toFixed(0) + "°C";
      document.getElementById("day4Max").innerHTML = "Max: " + Number(data.list[30].main.temp_max - 273.15).toFixed(0) + "°C";
      document.getElementById("day5Min").innerHTML = "Min: " + Number(data.list[34].main.temp_min - 273.15).toFixed(0) + "°C";
      document.getElementById("day5Max").innerHTML = "Max: " + Number(data.list[38].main.temp_max - 273.15).toFixed(0) + "°C";
      // Iconen
      document.getElementById("img0").src = "http://openweathermap.org/img/wn/" + data.list[0].weather[0].icon + "@2x.png";
      document.getElementById("img1").src = "http://openweathermap.org/img/wn/" + data.list[7].weather[0].icon + "@2x.png";
      document.getElementById("img2").src = "http://openweathermap.org/img/wn/" + data.list[15].weather[0].icon + "@2x.png";
      document.getElementById("img3").src = "http://openweathermap.org/img/wn/" + data.list[23].weather[0].icon + "@2x.png";
      document.getElementById("img4").src = "http://openweathermap.org/img/wn/" + data.list[31].weather[0].icon + "@2x.png";
      document.getElementById("img5").src = "http://openweathermap.org/img/wn/" + data.list[39].weather[0].icon + "@2x.png";

      overstaRubriken.innerHTML = text;
      namnPaStaden.value = text;

      console.log(data)
      andraSattet();

    })
}

function andraSattet() {
  const deleteAllInDiv5DaysDetAndraSattet = document.getElementById("annatApiDivenDarAlla5DagarnaLiggerIPaIndexHtml");
  deleteAllInDiv5DaysDetAndraSattet.innerHTML = '';

  let namnPaStaden2 = document.getElementById("vilkenStadInput");  // den som var från början SÖK rutan
  fetch("https://api.openweathermap.org/data/2.5/forecast?q=" + namnPaStaden2.value + "&appid=32ba0bfed592484379e51106cef3f204&units=metric")

    .then((response) => response.json())

    .then((data) => {
      const newData = data.list;
      const filteredData = newData.filter((f) => f.dt_txt.includes("12:00:00"));

      filteredData.map((m) => {
        console.log(m);

        // Denna div återfinns i index.html, med id annatApiDivenDarAlla5DagarnaLiggerIPaIndexHtml, detta är den inneslutande diven där alla 5 dagarna kommer att ligga
        const divenSomFinnsIndexHtmlSidanDar5DagarnaKommerAttFinnasI = document.querySelector('#annatApiDivenDarAlla5DagarnaLiggerIPaIndexHtml');
        // här är första grejen skapat en div som allt ska vara i

        // skapar en const variabel för att skapa ett element div
        const divenForDivenSomDatumTempOchIconKommerAttLiggaI = document.createElement('div')
        // Lägger till class för div:en där datum, temp och ikon kommer att ligga
        divenForDivenSomDatumTempOchIconKommerAttLiggaI.classList.add("classenForDivenSomDatumTempOchIconKommerAttLiggaI");
        // här appendar, lägger i 
        divenSomFinnsIndexHtmlSidanDar5DagarnaKommerAttFinnasI.appendChild(divenForDivenSomDatumTempOchIconKommerAttLiggaI);

        //visar Datumet slicar bort tiden
        createPElement = document.createElement('p')
        createPElement.classList.add("classenForP");
        divenForDivenSomDatumTempOchIconKommerAttLiggaI.appendChild(createPElement);
        createPElement.textContent = "Plats: " + namnPaStaden2.value;

        //visar Datumet slicar bort tiden
        createPElement = document.createElement('p')
        createPElement.classList.add("classenForP");
        divenForDivenSomDatumTempOchIconKommerAttLiggaI.appendChild(createPElement);
        createPElement.textContent = "Datum: " + m.dt_txt.slice(0, 10);

        //visar tiden slicar bort datumet
        createPElement = document.createElement('p')
        createPElement.classList.add("classenForP");
        divenForDivenSomDatumTempOchIconKommerAttLiggaI.appendChild(createPElement);
        createPElement.textContent = "Tid: " + m.dt_txt.slice(10, 16);

        divCreateH = document.createElement('img')
        divCreateH.classList.add("iconensClass");
        divenForDivenSomDatumTempOchIconKommerAttLiggaI.appendChild(divCreateH);
        divCreateH.src = "http://openweathermap.org/img/wn/" + m.weather[0].icon + "@2x.png";

        createPElement = document.createElement('p')
        createPElement.classList.add("minTemperaturClassenP");
        divenForDivenSomDatumTempOchIconKommerAttLiggaI.appendChild(createPElement);
        createPElement.textContent = "Min -Temp: " + m.main.temp_min.toFixed(0) + "°C";

        createPElement = document.createElement('p')
        createPElement.classList.add("maxTemperaturClassenP");
        divenForDivenSomDatumTempOchIconKommerAttLiggaI.appendChild(createPElement);
        createPElement.textContent = "Max-Temp: " + m.main.temp_max.toFixed(0) + "°C";
      })
    })
};