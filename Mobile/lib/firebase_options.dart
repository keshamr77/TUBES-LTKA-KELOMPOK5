// File generated manually based on google-services.json and Firebase Console config.
// Replaces `flutterfire configure` auto-generation.
//
// Project: tugas-besar-ltka-a29d4
// Firebase Console: https://console.firebase.google.com/project/tugas-besar-ltka-a29d4

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

/// Default [FirebaseOptions] for the current platform.
class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        // TODO: Tambahkan iOS config setelah GoogleService-Info.plist tersedia
        throw UnsupportedError(
          'DefaultFirebaseOptions belum dikonfigurasi untuk iOS. '
          'Download GoogleService-Info.plist dari Firebase Console.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions tidak tersedia untuk platform ini.',
        );
    }
  }

  // Data dari google-services.json
  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyBI9alMEyf8kWCXC-BvP2XHNaWF62qxUkc',
    appId: '1:1045005913293:android:cc838b702c79e0e67aad84',
    messagingSenderId: '1045005913293',
    projectId: 'tugas-besar-ltka-a29d4',
    storageBucket: 'tugas-besar-ltka-a29d4.firebasestorage.app',
  );

  // Data dari Dashboard/src/firebase.js
  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyAyktnDOygd6SFq7pXEvDnU-PTCaf4cmLY',
    appId: '1:1045005913293:web:d053c9008f20f86b7aad84',
    messagingSenderId: '1045005913293',
    projectId: 'tugas-besar-ltka-a29d4',
    storageBucket: 'tugas-besar-ltka-a29d4.firebasestorage.app',
    authDomain: 'tugas-besar-ltka-a29d4.firebaseapp.com',
  );
}
