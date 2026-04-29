import React, { useRef, forwardRef, useImperativeHandle, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';
import { MAPBOX_TOKEN } from '../../lib/mapbox';

/**
 * markers: Array<{ id: string, latitude: number, longitude: number, label: string, color: string, type?: 'self' | 'default' }>
 * center: { lat: number, lng: number }
 * zoom: number
 * onMarkerPress: (id: string) => void
 */

function buildHTML(center, zoom, markers, token) {
  const markersJS = markers
    .map((m) => {
      const label = String(m.label).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const type = m.type || 'default';
      return `addMarker('${m.id}', ${m.latitude}, ${m.longitude}, '${label}', '${m.color}', '${type}');`;
    })
    .join('\n  ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    html, body, #map { width:100%; height:100%; }
    .pill-marker {
      color:#fff; padding:5px 12px; border-radius:20px;
      font-size:12px; font-weight:800; border:2.5px solid #fff;
      box-shadow:0 3px 10px rgba(0,0,0,0.3); white-space:nowrap;
      cursor:pointer; transition:transform 0.15s, border-color 0.15s;
      line-height:1.2;
    }
    .self-marker {
      width:44px; height:44px; border-radius:50%;
      border:3px solid #fff; box-shadow:0 3px 10px rgba(0,0,0,0.3);
      display:flex; align-items:center; justify-content:center;
      font-size:18px; cursor:default;
    }
    .pin-marker {
      filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));
    }
  </style>
</head>
<body>
<div id="map"></div>
<script>
  var map = L.map('map', {
    zoomControl: false,
    attributionControl: true
  }).setView([${center.lat}, ${center.lng}], ${zoom});

  L.tileLayer(
    'https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}@2x?access_token=${token}',
    {
      attribution: '&copy; <a href="https://www.mapbox.com/about/maps/">Mapbox</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      tileSize: 512,
      zoomOffset: -1,
      maxZoom: 22,
    }
  ).addTo(map);

  var allMarkers = {};

  function createIcon(label, color, type) {
    var html;
    if (type === 'self') {
      html = '<div class="self-marker" style="background:' + color + '">👤</div>';
    } else if (type === 'pin') {
      html = '<div class="pin-marker"><svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg">' +
        '<path d="M14 0C6.27 0 0 6.27 0 14c0 9.63 14 22 14 22s14-12.37 14-22C28 6.27 21.73 0 14 0z" fill="' + color + '" stroke="white" stroke-width="1.5"/>' +
        '<circle cx="14" cy="13" r="5" fill="white" opacity="0.9"/>' +
        '</svg></div>';
    } else {
      html = '<div class="pill-marker" style="background:' + color + '">' + label + '</div>';
    }
    return L.divIcon({
      className: '',
      html: html,
      iconSize:   type === 'self' ? [44, 44] : type === 'pin' ? [28, 36] : [null, null],
      iconAnchor: type === 'self' ? [22, 22] : type === 'pin' ? [14, 36] : [20, 14],
    });
  }

  function addMarker(id, lat, lng, label, color, type) {
    if (allMarkers[id]) {
      map.removeLayer(allMarkers[id]);
    }
    var icon = createIcon(label, color, type);
    var mk = L.marker([lat, lng], { icon: icon }).addTo(map);
    if (type !== 'self') {
      mk.on('click', function () {
        window.ReactNativeWebView && window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'markerPress', id: id })
        );
      });
    }
    allMarkers[id] = mk;
  }

  function removeMarker(id) {
    if (allMarkers[id]) {
      map.removeLayer(allMarkers[id]);
      delete allMarkers[id];
    }
  }

  function highlightMarker(id) {
    Object.keys(allMarkers).forEach(function(mId) {
      var el = allMarkers[mId].getElement();
      if (!el) return;
      var pill = el.querySelector('.pill-marker');
      if (!pill) return;
      if (mId === id) {
        pill.style.transform = 'scale(1.25)';
        pill.style.borderColor = '#1D4ED8';
        pill.style.boxShadow = '0 4px 16px rgba(130,10,209,0.45)';
        pill.style.zIndex = '9999';
      } else {
        pill.style.transform = '';
        pill.style.borderColor = '#fff';
        pill.style.boxShadow = '0 3px 10px rgba(0,0,0,0.3)';
        pill.style.zIndex = '';
      }
    });
    if (id && allMarkers[id]) {
      map.panTo(allMarkers[id].getLatLng(), { animate: true, duration: 0.5 });
    }
  }

  // Initial markers
  ${markersJS}
</script>
</body>
</html>`;
}

const LeafletMapView = forwardRef(function LeafletMapView(
  { style, center, zoom = 13, markers = [], onMarkerPress },
  ref,
) {
  const webRef = useRef(null);

  useImperativeHandle(ref, () => ({
    highlightMarker(id) {
      webRef.current?.injectJavaScript(`highlightMarker('${id}'); true;`);
    },
    panTo(lat, lng) {
      webRef.current?.injectJavaScript(`map.panTo([${lat}, ${lng}], { animate: true }); true;`);
    },
  }));

  const html = useMemo(
    () => buildHTML(center, zoom, markers, MAPBOX_TOKEN),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(markers), center.lat, center.lng, zoom],
  );

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'markerPress' && onMarkerPress) {
        onMarkerPress(data.id);
      }
    } catch (_) {}
  };

  return (
    <WebView
      ref={webRef}
      source={{ html }}
      style={[StyleSheet.absoluteFillObject, style]}
      onMessage={handleMessage}
      originWhitelist={['*']}
      javaScriptEnabled
      domStorageEnabled
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
    />
  );
});

export default LeafletMapView;
