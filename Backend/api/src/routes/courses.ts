import { Router, Request, Response } from 'express';
import admin from 'firebase-admin';
import { db } from '../config/firebase';
import { requireAuth } from '../middleware/auth';

const router = Router();
const COURSES = 'courses';
const STUDENTS = 'students';

// Semua route di file ini membutuhkan autentikasi
router.use(requireAuth);

/**
 * [R6] GET /api/courses/:courseId/students/:nim
 * Validasi apakah mahasiswa (by NIM) terdaftar di sebuah mata kuliah.
 *
 * Struktur Firestore:
 *   courses/{courseId}/students/{randomDocId} → { nama, nim }
 * Karena document ID-nya random, mahasiswa dicari pakai query where('nim').
 *
 * Dipakai mobile sebelum absen: pastikan user terdaftar di kelas.
 */
router.get('/:courseId/students/:nim', async (req: Request, res: Response) => {
  try {
    const { courseId, nim } = req.params;

    if (!courseId || !nim) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'courseId dan nim wajib diisi' },
      });
    }

    // Pastikan course-nya ada
    const courseDoc = await db.collection(COURSES).doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({
        success: false,
        error: { code: 'COURSE_NOT_FOUND', message: 'Mata kuliah tidak ditemukan' },
      });
    }

    // Cari mahasiswa by NIM di sub-collection students
    const snapshot = await db
      .collection(COURSES)
      .doc(courseId)
      .collection(STUDENTS)
      .where('nim', '==', nim)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_ENROLLED',
          message: 'Mahasiswa tidak terdaftar di mata kuliah ini',
        },
        data: { enrolled: false },
      });
    }

    const studentData = snapshot.docs[0].data() as Record<string, any>;

    return res.json({
      success: true,
      data: {
        enrolled: true,
        nim: studentData.nim ?? nim,
        nama: studentData.nama ?? null,
        courseId,
        courseName: (courseDoc.data() as Record<string, any>).nama ?? null,
      },
    });
  } catch (error) {
    console.error('[GET /courses/:courseId/students/:nim]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal memvalidasi mahasiswa' },
    });
  }
});

/**
 * GET /api/courses/:courseId/students
 * List semua mahasiswa terdaftar di sebuah mata kuliah (buat dashboard/debug).
 */
router.get('/:courseId/students', async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;

    const courseDoc = await db.collection(COURSES).doc(courseId).get();
    if (!courseDoc.exists) {
      return res.status(404).json({
        success: false,
        error: { code: 'COURSE_NOT_FOUND', message: 'Mata kuliah tidak ditemukan' },
      });
    }

    const snapshot = await db
      .collection(COURSES)
      .doc(courseId)
      .collection(STUDENTS)
      .get();

    const students = snapshot.docs.map((doc: admin.firestore.QueryDocumentSnapshot) => {
      const d = doc.data() as Record<string, any>;
      return { id: doc.id, nim: d.nim ?? null, nama: d.nama ?? null };
    });

    return res.json({
      success: true,
      data: { courseId, total: students.length, students },
    });
  } catch (error) {
    console.error('[GET /courses/:courseId/students]', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Gagal memuat daftar mahasiswa' },
    });
  }
});

export default router;
