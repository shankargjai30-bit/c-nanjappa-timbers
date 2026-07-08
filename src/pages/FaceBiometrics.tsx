import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Camera, CheckCircle, ScanFace, XCircle, LogIn, LogOut } from 'lucide-react';
import { useApp } from '../context/AppContext';
import biometricsBg from '../assets/dashboard-backgrounds/biometrics-bg.webp';
import './FaceBiometrics.css';

interface BiometricMatch {
  id: string;
  name: string;
  department: string;
  time: string;
  status: string;
  confidence: number;
  action: 'check-in' | 'check-out';
  hoursWorked?: number;
  otHours?: number;
}

export default function FaceBiometrics() {
  const { employees, processBiometricAttendance, activityLogs, addActivityLog, addToast } = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<'success' | 'failed' | 'processing' | null>(null);
  const [matchedEmployee, setMatchedEmployee] = useState<BiometricMatch | null>(null);
  const [scanErrorMsg, setScanErrorMsg] = useState<string | null>(null);
  const [attendanceMode, setAttendanceMode] = useState<'check-in' | 'check-out'>('check-in');
  
  const faceMatcherRef = useRef<faceapi.FaceMatcher | null>(null);
  const scanTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const encodedEmployeeIds = useRef(new Set<string>());

  // Cleanup on unmount only
  useEffect(() => {
    return () => {
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  const modeRef = useRef<'check-in' | 'check-out'>('check-in');

  useEffect(() => {
    modeRef.current = attendanceMode;
  }, [attendanceMode]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsScanning(true);
        setScanResult(null);
        setScanErrorMsg(null);
        setMatchedEmployee(null);
      }
    } catch (err) {
      console.error("Error accessing webcam", err);
      setScanErrorMsg("Camera Access Denied");
      setScanResult('failed');
    }
  };

  const stopCamera = () => {
    setIsScanning(false);
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    const loadModelsAndData = async () => {
      const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';
      try {
        if (!isModelLoaded) {
          await Promise.all([
            faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
            faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
            faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
            faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
          ]);
        }

        const labeledDescriptors = faceMatcherRef.current ? [...faceMatcherRef.current.labeledDescriptors] : [];
        let hasNewData = false;
        
        for (const emp of employees) {
          if (emp.photo && !encodedEmployeeIds.current.has(emp.id)) {
            try {
              const img = new Image();
              img.src = emp.photo;
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
              });
              
              let detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
                .withFaceLandmarks()
                .withFaceDescriptor();

              if (!detection) {
                detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                  .withFaceLandmarks()
                  .withFaceDescriptor();
              }

              if (detection) {
                labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(emp.id, [detection.descriptor]));
                encodedEmployeeIds.current.add(emp.id);
                hasNewData = true;
              }
            } catch (e) {
              console.error(`Failed to load descriptor for employee ${emp.name}`, e);
            }
          }
        }

        if (hasNewData || (!faceMatcherRef.current && labeledDescriptors.length > 0)) {
          faceMatcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
        }

        setIsModelLoaded(true);
      } catch (err) {
        console.error("Error loading face-api models", err);
      }
    };
    loadModelsAndData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees]);

  const handleVideoPlay = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !isScanning) return;
      
      setScanResult((currentScanResult) => {
        if (currentScanResult) return currentScanResult;
        
        (async () => {
          const detections = await faceapi.detectAllFaces(videoRef.current!, new faceapi.TinyFaceDetectorOptions())
            .withFaceLandmarks()
            .withFaceDescriptors();
          
          if (!canvasRef.current) return;
          const resizedDetections = faceapi.resizeResults(detections, displaySize);
          canvasRef.current.getContext('2d')?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          
          let matched = false;

          resizedDetections.forEach(detection => {
            const box = detection.detection.box;
            const ctx = canvasRef.current!.getContext('2d');
            if (ctx) {
              ctx.strokeStyle = 'rgba(35, 31, 133, 0.8)';
              ctx.lineWidth = 3;
              ctx.strokeRect(box.x, box.y, box.width, box.height);
              
              if (!matched) {
                if (faceMatcherRef.current) {
                  const bestMatch = faceMatcherRef.current.findBestMatch(detection.descriptor);
                  if (bestMatch.label !== 'unknown') {
                    matched = true;
                    handleMatchSuccess(bestMatch.label, bestMatch.distance);
                  } else if (detection.detection.score > 0.8) {
                    matched = true;
                    
                    let bestEmpName = "Unknown Person";
                    let bestDist = 1.0;
                    faceMatcherRef.current.labeledDescriptors.forEach(ld => {
                       ld.descriptors.forEach(d => {
                          const dist = faceapi.euclideanDistance(detection.descriptor, d);
                          if (dist < bestDist) {
                             bestDist = dist;
                             const emp = employees.find(e => e.id === ld.label);
                             if (emp) bestEmpName = emp.name;
                          }
                       });
                    });
                    
                    handleMatchFailed("Face Not Recognized", bestEmpName);
                  }
                } else if (detection.detection.score > 0.8) {
                  matched = true;
                  handleMatchFailed("No employees configured with photos.");
                }
              }
            }
          });
        })();
        
        return currentScanResult;
      });
    }, 500);
  };

  const handleMatchSuccess = (empId: string, distance: number) => {
    setScanResult('processing');
    stopCamera();
    
    // We use a small timeout to allow state updates to settle before showing success
    setTimeout(async () => {
      const emp = employees.find(e => e.id === empId);
      if (!emp) {
        handleMatchFailed("Employee not found");
        return;
      }

      let determinedAction: 'check-in' | 'check-out' = 'check-in';
      if (emp.status === 'Absent' || emp.status === 'On Leave' || emp.status === 'Late' || !emp.checkIn || emp.checkIn === '--') {
        determinedAction = 'check-in';
      } else if (emp.checkIn && emp.checkIn !== '--' && (!emp.checkOut || emp.checkOut === '--')) {
        determinedAction = 'check-out';
      } else {
        addToast("Attendance Already Marked", "error");
        addActivityLog(emp.name, "scanned but attendance already marked for today", "warning");
        handleMatchFailed("Attendance already completed for today");
        return;
      }

      const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const confidence = Math.round((1 - distance) * 100);

      const result = await processBiometricAttendance(empId, determinedAction, timeStr);
      
      if (!result.success) {
        addToast(result.error === 'Employee already checked in today' || result.error === 'Employee already checked out today' ? "Attendance Already Marked" : "Verification failed", "error");
        handleMatchFailed(result.error || "Verification failed");
        return;
      }

      addToast(`${determinedAction === 'check-in' ? 'Check In' : 'Check Out'} Successful`, "success");
      setScanResult('success');
      setMatchedEmployee({
        id: emp.id,
        name: emp.name,
        department: emp.department,
        time: timeStr,
        status: determinedAction === 'check-in' ? 'Checked In' : 'Checked Out',
        confidence,
        action: determinedAction,
        hoursWorked: result.hoursWorked,
        otHours: result.otHours
      });
      
      scanTimeoutRef.current = setTimeout(() => {
        setScanResult(null);
        setMatchedEmployee(null);
      }, 6000); // Wait 6 seconds before clearing screen so they can read it
    }, 100);
  };

  const handleMatchFailed = (msg: string, empName?: string) => {
    setScanResult('failed');
    setScanErrorMsg(msg);
    
    if (msg === "Face Not Recognized") {
      addToast("Face Not Matched", "error");
      addActivityLog(empName || "Unknown Person", "Face verification failed", "warning");
    }
    
    scanTimeoutRef.current = setTimeout(() => {
      setScanResult(null);
      setScanErrorMsg(null);
    }, 3000);
  };

  const recentCheckIns = activityLogs
    .filter(log => {
      const act = log.action.toLowerCase();
      return act.includes('checked in') || 
             act.includes('checked out') || 
             act.includes('face scan') || 
             act.includes('biometric') || 
             act.includes('attendance');
    })
    .slice(0, 5);

  return (
    <>
      <div className="dashboard-bg-wrapper" style={{ backgroundImage: `url(${biometricsBg})` }}></div>
      <div className="dashboard-bg-overlay"></div>
      <div className="biometrics-page" style={{ position: 'relative', zIndex: 1 }}>
        <div className="page-header">
        <div>
          <h1 className="page-title">Face Biometrics System</h1>
          <p className="page-subtitle">AI-powered employee check-in & check-out</p>
        </div>
        <div className="status-badge">
          <span className={`indicator ${isModelLoaded ? 'online' : 'loading'}`}></span>
          {isModelLoaded ? 'System Active' : 'Loading AI Models...'}
        </div>
      </div>

      <div className="biometrics-grid">
        <div className="scanner-section">
          <div className="mode-toggle-container" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            <button 
              className={`mode-btn ${attendanceMode === 'check-in' ? 'active check-in' : ''}`}
              onClick={() => setAttendanceMode('check-in')}
              style={{ flex: '1 1 45%' }}
            >
              <LogIn size={20} />
              Auto Check In
            </button>
            <button 
              className={`mode-btn ${attendanceMode === 'check-out' ? 'active check-out' : ''}`}
              onClick={() => setAttendanceMode('check-out')}
              style={{ flex: '1 1 45%' }}
            >
              <LogOut size={20} />
              Auto Check Out
            </button>
            <button 
              className={`mode-btn`}
              onClick={startCamera}
              disabled={isScanning || !isModelLoaded}
              style={{ flex: '1 1 45%', backgroundColor: isScanning ? 'var(--surface-hover)' : 'var(--primary)', color: isScanning ? 'var(--text-muted)' : 'white' }}
            >
              <Camera size={20} /> Start Scanning
            </button>
            <button 
              className={`mode-btn`}
              onClick={stopCamera}
              disabled={!isScanning}
              style={{ flex: '1 1 45%', backgroundColor: !isScanning ? 'var(--surface-hover)' : 'var(--danger)', color: !isScanning ? 'var(--text-muted)' : 'white' }}
            >
              <XCircle size={20} /> Stop Scanning
            </button>
          </div>

          <div className="scanner-card card mt-4">
            <div className="camera-container">
              {!isModelLoaded && (
                <div className="camera-loading">
                  <ScanFace size={48} className="pulse-icon" />
                  <p>Initializing Biometric Engine...</p>
                </div>
              )}
              <video 
                ref={videoRef} 
                autoPlay 
                muted 
                onPlay={handleVideoPlay}
                className={isModelLoaded ? 'active' : 'hidden'}
              />
              <canvas ref={canvasRef} className="overlay-canvas" />
              
              {isScanning && !scanResult && (
                <div className="scanning-overlay">
                  <div className="scan-line"></div>
                </div>
              )}
            </div>
            
            <div className="scanner-footer">
              <div className="camera-status">
                <Camera size={18} />
                <span>Camera 01 - Main Entrance ({attendanceMode === 'check-in' ? 'Entry' : 'Exit'})</span>
              </div>
              <button className="manual-override-btn">Manual Entry</button>
            </div>
          </div>
        </div>

        <div className="results-section">
          {scanResult === 'success' && matchedEmployee ? (
            <div className="result-card success-card card animated">
              <div className="result-header">
                <CheckCircle size={32} className="success-icon" />
                <h2>{matchedEmployee.action === 'check-in' ? 'Check-In' : 'Check-Out'} Successful</h2>
              </div>
              
              <div className="employee-profile-preview">
                <div className="preview-avatar">{matchedEmployee.name.charAt(0)}</div>
                <div className="preview-info">
                  <h3>{matchedEmployee.name}</h3>
                  <p>{matchedEmployee.id} | {matchedEmployee.department}</p>
                </div>
              </div>
              
              <div className="scan-details">
                <div className="detail-row">
                  <span>Time</span>
                  <strong>{matchedEmployee.time}</strong>
                </div>
                <div className="detail-row">
                  <span>Attendance Status</span>
                  <strong className="text-success">{matchedEmployee.status}</strong>
                </div>
                {matchedEmployee.action === 'check-out' && matchedEmployee.hoursWorked !== undefined && (
                  <div className="detail-row">
                    <span>Total Hours</span>
                    <strong>{matchedEmployee.hoursWorked}h</strong>
                  </div>
                )}
                {matchedEmployee.action === 'check-out' && !!matchedEmployee.otHours && (
                  <div className="detail-row">
                    <span>Overtime</span>
                    <strong style={{ color: '#d97706' }}>{matchedEmployee.otHours}h</strong>
                  </div>
                )}
                <div className="detail-row">
                  <span>Face Match Confidence</span>
                  <strong>{matchedEmployee.confidence}%</strong>
                </div>
              </div>
            </div>
          ) : scanResult === 'failed' ? (
            <div className="result-card failed-card card animated">
              <div className="result-header">
                <XCircle size={48} className="failed-icon" />
                <h2 className="error-text">Verification Failed</h2>
              </div>
              <p>{scanErrorMsg || 'Please ensure you are registered and facing the camera clearly.'}</p>
            </div>
          ) : (
            <div className="result-card idle-card card">
              <ScanFace size={48} className="idle-icon" />
              <h3>Ready for {attendanceMode === 'check-in' ? 'Check-In' : 'Check-Out'}</h3>
              <p>Please face the camera to mark your attendance.</p>
            </div>
          )}

          <div className="recent-scans card mt-6">
            <div className="card-header">
              <h3>Recent Activity</h3>
            </div>
            <div className="scan-list">
              {recentCheckIns.length > 0 ? recentCheckIns.map((log) => (
                <div key={log.id} className="scan-list-item">
                  <div className="item-avatar">{log.employeeName.charAt(0)}</div>
                  <div className="item-info">
                    <p className="item-name">{log.employeeName}</p>
                    <p className="item-id">{log.action}</p>
                  </div>
                  <div className="item-time">{new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
              )) : (
                <p className="text-muted text-sm text-center py-4">No recent activity</p>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>
    </>
  );
}
