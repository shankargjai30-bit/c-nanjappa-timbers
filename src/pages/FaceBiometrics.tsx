import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';
import { Capacitor } from '@capacitor/core';
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
  const encodedEmployeeIds = useRef(new Set<string>());
  
  // Dynamic biometrics diagnostic data state
  const [diagnosticData, setDiagnosticData] = useState<Record<string, {
    status: 'Ready' | 'No Face Located' | 'No Photo' | 'Loading' | 'Error';
    details?: string;
  }>>({});
  
  // Refs to control non-overlapping scanning loops
  const scanActiveRef = useRef(false);
  const isScanningRef = useRef(false);

  useEffect(() => {
    isScanningRef.current = isScanning;
    if (isScanning) {
      if (videoRef.current && videoRef.current.readyState >= 2) {
        startScanningLoop();
      }
    } else {
      scanActiveRef.current = false;
    }
  }, [isScanning]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      scanActiveRef.current = false;
      isScanningRef.current = false;
      if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  const modeRef = useRef<'check-in' | 'check-out'>('check-in');
  const lastMismatchToastRef = useRef<number>(0);
  const MISMATCH_TOAST_COOLDOWN_MS = 5000;

  useEffect(() => {
    modeRef.current = attendanceMode;
  }, [attendanceMode]);

  const startCamera = async () => {
    if (isScanning || scanActiveRef.current) return;
    try {
      lastMismatchToastRef.current = 0;
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
    scanActiveRef.current = false;
    isScanningRef.current = false;
    if (videoRef.current && videoRef.current.srcObject) {
      (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    }
    lastMismatchToastRef.current = 0;
  };

  useEffect(() => {
    const loadModelsAndData = async () => {
      const MODEL_URL = Capacitor.isNativePlatform() ? '/models' : '/models'; // Local weights assets path
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
        
        // Initialize placeholders in diagnostic list
        employees.forEach(emp => {
          if (!emp.photo) {
            setDiagnosticData(prev => ({ ...prev, [emp.id]: { status: 'No Photo', details: 'No registration photo uploaded.' } }));
          } else if (!encodedEmployeeIds.current.has(emp.id)) {
            setDiagnosticData(prev => ({ ...prev, [emp.id]: { status: 'Loading', details: 'Awaiting neural landmarks detection...' } }));
          }
        });
        
        for (const emp of employees) {
          if (emp.photo && !encodedEmployeeIds.current.has(emp.id)) {
            try {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.src = emp.photo;
              await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = reject;
              });
              
              let detection = await faceapi.detectSingleFace(img, new faceapi.SsdMobilenetv1Options())
                .withFaceLandmarks()
                .withFaceDescriptor();

              if (!detection) {
                // Fallback to tiny face detector
                detection = await faceapi.detectSingleFace(img, new faceapi.TinyFaceDetectorOptions())
                  .withFaceLandmarks()
                  .withFaceDescriptor();
              }

              if (detection) {
                labeledDescriptors.push(new faceapi.LabeledFaceDescriptors(emp.id, [detection.descriptor]));
                encodedEmployeeIds.current.add(emp.id);
                hasNewData = true;
                setDiagnosticData(prev => ({ 
                  ...prev, 
                  [emp.id]: { status: 'Ready', details: 'Face landmarks descriptor generated and loaded in memory.' } 
                }));
              } else {
                setDiagnosticData(prev => ({ 
                  ...prev, 
                  [emp.id]: { status: 'No Face Located', details: 'Landmarks extraction failed. Ensure your registration photo is a clear, front-facing portrait with good lighting.' } 
                }));
              }
            } catch (e: any) {
              console.error(`Failed to load descriptor for employee ${emp.name}`, e);
              setDiagnosticData(prev => ({ 
                ...prev, 
                [emp.id]: { status: 'Error', details: `Image load failure: ${e?.message || 'Check storage or networking.'}` } 
              }));
            }
          } else if (emp.photo && encodedEmployeeIds.current.has(emp.id)) {
            setDiagnosticData(prev => ({ 
              ...prev, 
              [emp.id]: { status: 'Ready', details: 'Face landmarks descriptor loaded in memory.' } 
            }));
          }
        }

        if (hasNewData || (!faceMatcherRef.current && labeledDescriptors.length > 0)) {
          faceMatcherRef.current = new faceapi.FaceMatcher(labeledDescriptors, 0.6);
        }

        setIsModelLoaded(true);
      } catch (err: any) {
        console.error("Error loading face-api models", err);
        console.error("Model URL:", '/models');

        addToast(
          `Failed to load face models: ${err?.message || String(err)}`,
          'error'
        );

        employees.forEach(emp => {
          if (emp.photo) {
            setDiagnosticData(prev => ({ 
              ...prev, 
              [emp.id]: { 
                status: 'Error', 
                details: `Model load error: ${err?.message || 'Unknown model loading error.'}` 
              } 
            }));
          }
        });
      }
    };
    
    loadModelsAndData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employees]);

  // Recursive Non-Overlapping Webcam Scanning Loop
  const startScanningLoop = () => {
    if (scanActiveRef.current) return;
    scanActiveRef.current = true;

    const canvas = canvasRef.current;
    if (!videoRef.current || !canvas) {
      scanActiveRef.current = false;
      return;
    }

    const displaySize = { width: videoRef.current.videoWidth, height: videoRef.current.videoHeight };
    faceapi.matchDimensions(canvas, displaySize);

    const loop = async () => {
      // Loop guard checks
      if (!scanActiveRef.current || !videoRef.current || !isScanningRef.current) {
        scanActiveRef.current = false;
        return;
      }

      try {
        const detections = await faceapi.detectAllFaces(videoRef.current, new faceapi.TinyFaceDetectorOptions())
          .withFaceLandmarks()
          .withFaceDescriptors();

        if (!canvasRef.current || !scanActiveRef.current) return;
        const resizedDetections = faceapi.resizeResults(detections, displaySize);
        canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);

        let matched = false;

        resizedDetections.forEach(detection => {
          const box = detection.detection.box;
          const ctx = canvas.getContext('2d');
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
                handleMatchFailed("Face recognition not ready. Check the Biometric Status panel — employee photos may still be loading.");
              }
            }
          }
        });
      } catch (err) {
        console.error("Frame detection loop error:", err);
      }

      // Schedule next check only after the current check finishes
      if (scanActiveRef.current && isScanningRef.current) {
        setTimeout(loop, 100); // 100ms throttle to prevent CPU thrashing
      } else {
        scanActiveRef.current = false;
      }
    };

    loop();
  };

  const handleVideoPlay = () => {
    if (isScanningRef.current) {
      startScanningLoop();
    }
  };

  const handleMatchSuccess = (empId: string, distance: number) => {
    setScanResult('processing');
    stopCamera();
    
    setTimeout(async () => {
      const emp = employees.find(e => e.id === empId);
      if (!emp) {
        handleMatchFailed("Employee not found");
        return;
      }

      const confidence = Math.round((1 - distance) * 100);
      const currentMode = modeRef.current; // Read from ref — never stale inside async closure
      const result = await processBiometricAttendance(empId, currentMode);
      
      if (!result.success) {
        addToast(result.error || "Verification failed", "error");
        handleMatchFailed(result.error || "Verification failed");
        return;
      }

      const action = result.action;
      const timeStr = result.time;

      addToast(`${action === 'check-in' ? 'Check In' : 'Check Out'} Successful`, "success");
      setScanResult('success');
      setMatchedEmployee({
        id: emp.id,
        name: emp.name,
        department: emp.department,
        time: timeStr || '',
        status: action === 'check-in' ? 'Checked In' : 'Checked Out',
        confidence,
        action: (action as 'check-in' | 'check-out') || 'check-in',
        hoursWorked: result.hoursWorked,
        otHours: result.otHours
      });
      
      scanTimeoutRef.current = setTimeout(() => {
        setScanResult(null);
        setMatchedEmployee(null);
      }, 6000);
    }, 100);
  };

  const handleMatchFailed = (msg: string, empName?: string) => {
    setScanResult('failed');
    setScanErrorMsg(msg);
    
    if (msg === "Face Not Recognized") {
      const now = Date.now();
      if (now - lastMismatchToastRef.current > MISMATCH_TOAST_COOLDOWN_MS) {
        lastMismatchToastRef.current = now;
        addToast("Face Not Matched", "error");
        addActivityLog(empName || "Unknown Person", "Face verification failed", "warning");
      }
    }
    
    if (scanTimeoutRef.current) clearTimeout(scanTimeoutRef.current);
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
          <div className="biometric-actions-wrapper">
            <div className="workflow-section">
              <div className="workflow-step-badge">1. Select Mode</div>
              <div className="mode-selector-container">
                <button 
                  type="button"
                  className={`mode-btn ${attendanceMode === 'check-in' ? 'active check-in' : ''}`}
                  onClick={() => setAttendanceMode('check-in')}
                  aria-pressed={attendanceMode === 'check-in'}
                >
                  <LogIn size={18} />
                  Check In Mode
                </button>
                <button 
                  type="button"
                  className={`mode-btn ${attendanceMode === 'check-out' ? 'active check-out' : ''}`}
                  onClick={() => setAttendanceMode('check-out')}
                  aria-pressed={attendanceMode === 'check-out'}
                >
                  <LogOut size={18} />
                  Check Out Mode
                </button>
              </div>
            </div>

            <div className="workflow-section">
              <div className="workflow-step-badge">2. Scan Control</div>
              <div className="scan-controls-container">
                <button 
                  type="button"
                  className="scan-action-btn start-scan-btn"
                  onClick={startCamera}
                  disabled={isScanning || !isModelLoaded}
                >
                  <Camera size={18} />
                  {isScanning ? 'Scanning Active' : 'Start Scanning'}
                </button>
                <button 
                  type="button"
                  className="scan-action-btn stop-scan-btn"
                  onClick={stopCamera}
                  disabled={!isScanning}
                >
                  <XCircle size={18} />
                  Stop Scanning
                </button>
              </div>
            </div>
          </div>

          <div className="scanner-card card">
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
                playsInline
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

          <div className="recent-scans card">
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

      {/* Dynamic Biometric Diagnostics Panel */}
      <div className="diagnostics-panel card p-6">
        <div className="card-header border-b pb-4 mb-4" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
          <h3 className="text-xl font-bold flex items-center gap-2" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
            <ScanFace size={24} style={{ color: 'var(--primary)' }} />
            Biometric Registration Diagnostics
          </h3>
          <p className="text-muted text-sm mt-1" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem', marginBottom: 0 }}>
            Real-time status of face descriptors compiled into gate scanner memory. Invalid photos will fail checks.
          </p>
        </div>
        
        <div className="diagnostics-grid">
          {employees.map(emp => {
            const diag = diagnosticData[emp.id] || { status: emp.photo ? 'Loading' : 'No Photo', details: 'Awaiting initialization...' };
            
            let statusColor = 'var(--text-muted)';
            let statusBg = 'var(--surface-hover)';
            
            if (diag.status === 'Ready') {
              statusColor = '#10b981';
              statusBg = '#ecfdf5';
            } else if (diag.status === 'No Face Located') {
              statusColor = '#ef4444';
              statusBg = '#fef2f2';
            } else if (diag.status === 'Error') {
              statusColor = '#f59e0b';
              statusBg = '#fffbeb';
            }
            
            return (
              <div key={emp.id} className="p-4 rounded-lg border flex flex-col gap-3" style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: '8px', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  {emp.photo ? (
                    <img 
                      src={emp.photo} 
                      alt={emp.name} 
                      style={{ width: '48px', height: '48px', minWidth: '48px', borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }}
                    />
                  ) : (
                    <div 
                      style={{ width: '48px', height: '48px', minWidth: '48px', borderRadius: '50%', border: '1px solid var(--border)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', backgroundColor: 'var(--surface-hover)' }}
                    >
                      <ScanFace size={20} />
                    </div>
                  )}
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <h4 style={{ fontSize: '0.875rem', fontWeight: 'bold', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</h4>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.id} | {emp.department}</p>
                  </div>
                </div>
                
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span 
                      style={{ fontSize: '0.75rem', fontWeight: '600', padding: '0.125rem 0.5rem', borderRadius: '9999px', color: statusColor, backgroundColor: statusBg }}
                    >
                      {diag.status}
                    </span>
                  </div>
                  {diag.details && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.375rem', marginBottom: 0, lineHeight: '1.4', wordBreak: 'break-word' }}>
                      {diag.details}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
    </>
  );
}
