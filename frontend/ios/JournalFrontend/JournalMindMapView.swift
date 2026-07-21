import Foundation
import QuartzCore
import React
import SceneKit
import simd
import UIKit

private struct MindMapPalette {
  let background: UIColor
  let node: UIColor
  let nodeHot: UIColor
  let selectedNode: UIColor
  let outline: UIColor
  let edgeActive: UIColor

  static let dark = MindMapPalette(
    background: UIColor.mindMapHex("#14110F"),
    node: UIColor.mindMapHex("#F0B45E"),
    nodeHot: UIColor.mindMapHex("#FFE2A8"),
    selectedNode: UIColor.mindMapHex("#E87461"),
    outline: UIColor.mindMapHex("#D2AD72"),
    edgeActive: UIColor.mindMapHex("#F0B45E")
  )

  static let light = MindMapPalette(
    background: UIColor.mindMapHex("#FDFCFB"),
    node: UIColor.mindMapHex("#E87461"),
    nodeHot: UIColor.mindMapHex("#F0B45E"),
    selectedNode: UIColor.mindMapHex("#7B4639"),
    outline: UIColor.mindMapHex("#B98253"),
    edgeActive: UIColor.mindMapHex("#E87461")
  )
}

private struct MindMapRegionRecord {
  let id: String
  let label: String
  let subtitle: String
  let signalScore: Float
  let confidence: Float
  let intensity: String
  let isStrongest: Bool
}

private struct RegionTemplate {
  let position: SCNVector3
  let scale: SCNVector3
  let euler: SCNVector3
}

private let regionTemplates: [String: RegionTemplate] = [
  "planning_self_control": RegionTemplate(
    position: SCNVector3(0, 0.56, 0.66),
    scale: SCNVector3(1.18, 0.62, 0.86),
    euler: SCNVector3(-0.08, 0.08, 0.18)
  ),
  "emotional_intensity": RegionTemplate(
    position: SCNVector3(0, -0.28, 0.86),
    scale: SCNVector3(1.02, 0.54, 0.52),
    euler: SCNVector3(0.12, 0, 0)
  ),
  "memory_meaning": RegionTemplate(
    position: SCNVector3(1.02, -0.04, 0.08),
    scale: SCNVector3(0.62, 0.54, 1.02),
    euler: SCNVector3(0, -0.22, 0.06)
  ),
  "body_inner_signals": RegionTemplate(
    position: SCNVector3(0.38, -0.16, 0.1),
    scale: SCNVector3(0.56, 0.66, 0.6),
    euler: SCNVector3(-0.14, 0.24, 0.14)
  ),
  "conflict_attention": RegionTemplate(
    position: SCNVector3(0, 0.12, 0.34),
    scale: SCNVector3(0.76, 0.44, 0.54),
    euler: SCNVector3(-0.08, 0, 0)
  ),
  "motivation_reward": RegionTemplate(
    position: SCNVector3(0, -0.68, 0.06),
    scale: SCNVector3(0.82, 0.34, 0.66),
    euler: SCNVector3(0.1, 0, 0)
  ),
  "relationships_perspective": RegionTemplate(
    position: SCNVector3(-0.94, 0.02, -0.72),
    scale: SCNVector3(0.76, 0.52, 0.88),
    euler: SCNVector3(0.02, 0.18, -0.1)
  ),
  "self_reflection_identity": RegionTemplate(
    position: SCNVector3(0, 0.22, -0.74),
    scale: SCNVector3(1.06, 0.62, 0.72),
    euler: SCNVector3(0.04, 0, 0)
  ),
]

private let seamPairs: [(String, String)] = [
  ("planning_self_control", "conflict_attention"),
  ("planning_self_control", "self_reflection_identity"),
  ("planning_self_control", "memory_meaning"),
  ("emotional_intensity", "conflict_attention"),
  ("emotional_intensity", "motivation_reward"),
  ("memory_meaning", "body_inner_signals"),
  ("body_inner_signals", "motivation_reward"),
  ("relationships_perspective", "self_reflection_identity"),
  ("conflict_attention", "motivation_reward"),
]

@objc(JournalMindMapView)
class JournalMindMapView: UIView, UIGestureRecognizerDelegate {
  @objc var regions: NSArray = [] {
    didSet {
      scheduleRebuild()
    }
  }

  @objc var selectedRegionId: NSString? {
    didSet {
      DispatchQueue.main.async { [weak self] in
        self?.updateSelectionStyles(animated: true)
      }
    }
  }

  @objc var graphPalette: NSDictionary? {
    didSet {
      DispatchQueue.main.async { [weak self] in
        self?.applyTheme()
        self?.scheduleRebuild()
      }
    }
  }

  @objc var themeMode: NSString = "dark" {
    didSet {
      DispatchQueue.main.async { [weak self] in
        self?.applyTheme()
        self?.scheduleRebuild()
      }
    }
  }

  @objc var cameraResetToken: NSNumber? {
    didSet {
      let token = cameraResetToken?.doubleValue

      guard token != lastCameraResetToken else {
        return
      }

      lastCameraResetToken = token
      DispatchQueue.main.async { [weak self] in
        self?.resetCamera(animated: true)
      }
    }
  }

  @objc var reduceMotionEnabled: Bool = false {
    didSet {
      DispatchQueue.main.async { [weak self] in
        self?.updateSelectionStyles(animated: false)
      }
    }
  }

  @objc var onRegionPress: RCTDirectEventBlock?

  private let sceneView = SCNView()
  private let scene = SCNScene()
  private let contentRoot = SCNNode()
  private let shellNode = SCNNode()
  private let seamsNode = SCNNode()
  private let regionsNode = SCNNode()
  private let cameraNode = SCNNode()
  private let keyLightNode = SCNNode()
  private let fillLightNode = SCNNode()
  private var regionRecords: [MindMapRegionRecord] = []
  private var regionNodes: [String: SCNNode] = [:]
  private var pendingRebuild = false
  private var lastCameraResetToken: Double?
  private var cameraDistance: Float = 4.9
  private var gestureStartCameraDistance: Float = 4.9
  private var rotationYaw: Float = -0.56
  private var rotationPitch: Float = 0.08
  private var previousPanTranslation = CGPoint.zero

  private var palette: MindMapPalette {
    graphPaletteValue() ?? (themeMode.lowercased == "light" ? .light : .dark)
  }

  override init(frame: CGRect) {
    super.init(frame: frame)
    setupScene()
  }

  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupScene()
  }

  private func graphPaletteValue() -> MindMapPalette? {
    guard let paletteDictionary = dictionary(from: graphPalette) else {
      return nil
    }

    let fallback = themeMode.lowercased == "light" ? MindMapPalette.light : MindMapPalette.dark

    return MindMapPalette(
      background: colorValue(paletteDictionary["background"], fallback: fallback.background),
      node: colorValue(paletteDictionary["node"], fallback: fallback.node),
      nodeHot: colorValue(paletteDictionary["nodeHot"], fallback: fallback.nodeHot),
      selectedNode: colorValue(
        paletteDictionary["selectedNode"],
        fallback: fallback.selectedNode
      ),
      outline: colorValue(paletteDictionary["outline"], fallback: fallback.outline),
      edgeActive: colorValue(
        paletteDictionary["edgeActive"],
        fallback: fallback.edgeActive
      )
    )
  }

  private func colorValue(_ value: Any?, fallback: UIColor) -> UIColor {
    guard let hex = value as? String, hex.hasPrefix("#") else {
      return fallback
    }

    return UIColor.mindMapHex(hex)
  }

  private func setupScene() {
    clipsToBounds = true
    backgroundColor = palette.background

    sceneView.translatesAutoresizingMaskIntoConstraints = false
    sceneView.scene = scene
    sceneView.backgroundColor = palette.background
    sceneView.antialiasingMode = .multisampling4X
    sceneView.autoenablesDefaultLighting = false
    sceneView.allowsCameraControl = false
    sceneView.preferredFramesPerSecond = 60
    sceneView.isPlaying = true

    addSubview(sceneView)
    NSLayoutConstraint.activate([
      sceneView.leadingAnchor.constraint(equalTo: leadingAnchor),
      sceneView.trailingAnchor.constraint(equalTo: trailingAnchor),
      sceneView.topAnchor.constraint(equalTo: topAnchor),
      sceneView.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])

    scene.rootNode.addChildNode(contentRoot)
    contentRoot.addChildNode(shellNode)
    contentRoot.addChildNode(seamsNode)
    contentRoot.addChildNode(regionsNode)

    setupCamera()
    setupLights()
    setupGestures()
    applyTheme()
    scheduleRebuild()
  }

  private func setupCamera() {
    let camera = SCNCamera()
    camera.fieldOfView = 42
    camera.zNear = 0.01
    camera.zFar = 100
    cameraNode.camera = camera
    scene.rootNode.addChildNode(cameraNode)
    updateCameraPosition()
    updateContentRotation()
  }

  private func setupLights() {
    let ambientLight = SCNLight()
    ambientLight.type = .ambient
    ambientLight.intensity = 580
    fillLightNode.light = ambientLight
    scene.rootNode.addChildNode(fillLightNode)

    let keyLight = SCNLight()
    keyLight.type = .omni
    keyLight.intensity = 920
    keyLightNode.light = keyLight
    keyLightNode.position = SCNVector3(4.2, 4.8, 5.8)
    scene.rootNode.addChildNode(keyLightNode)
  }

  private func setupGestures() {
    let panGesture = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
    let pinchGesture = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
    let tapGesture = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))

    panGesture.delegate = self
    pinchGesture.delegate = self
    tapGesture.delegate = self

    sceneView.addGestureRecognizer(panGesture)
    sceneView.addGestureRecognizer(pinchGesture)
    sceneView.addGestureRecognizer(tapGesture)
  }

  private func scheduleRebuild() {
    guard !pendingRebuild else {
      return
    }

    pendingRebuild = true
    DispatchQueue.main.async { [weak self] in
      guard let self else {
        return
      }

      self.pendingRebuild = false
      self.rebuildScene()
    }
  }

  private func rebuildScene() {
    regionRecords = parseRegions()
    shellNode.childNodes.forEach { $0.removeFromParentNode() }
    seamsNode.childNodes.forEach { $0.removeFromParentNode() }
    regionsNode.childNodes.forEach { $0.removeFromParentNode() }
    regionNodes.removeAll()

    buildShell()
    buildSeams()
    buildRegions()
    updateSelectionStyles(animated: false)
  }

  private func parseRegions() -> [MindMapRegionRecord] {
    regions.compactMap { item in
      guard
        let dictionary = dictionary(from: item),
        let id = dictionary["id"] as? String,
        let label = dictionary["label"] as? String,
        let subtitle = dictionary["subtitle"] as? String,
        let signalScore = floatValue(dictionary["signalScore"]),
        let confidence = floatValue(dictionary["confidence"]),
        let intensity = dictionary["intensity"] as? String
      else {
        return nil
      }

      return MindMapRegionRecord(
        id: id,
        label: label,
        subtitle: subtitle,
        signalScore: min(max(signalScore, 0), 1),
        confidence: min(max(confidence, 0), 1),
        intensity: intensity,
        isStrongest: (dictionary["isStrongest"] as? Bool) ?? false
      )
    }
  }

  private func buildShell() {
    let shellGeometry = SCNSphere(radius: 1.16)
    shellGeometry.segmentCount = 10
    shellGeometry.materials = [
      material(
        color: palette.outline.withAlphaComponent(0.16),
        emission: palette.outline.withAlphaComponent(0.22),
        transparency: 0.14
      ),
    ]

    let node = SCNNode(geometry: shellGeometry)
    node.scale = SCNVector3(1.94, 1.36, 1.52)
    node.position = SCNVector3(0, 0.02, 0)
    shellNode.addChildNode(node)

    let lowerShell = SCNSphere(radius: 0.42)
    lowerShell.segmentCount = 8
    lowerShell.materials = [
      material(
        color: palette.outline.withAlphaComponent(0.14),
        emission: palette.outline.withAlphaComponent(0.18),
        transparency: 0.12
      ),
    ]

    let lowerNode = SCNNode(geometry: lowerShell)
    lowerNode.scale = SCNVector3(1.1, 0.92, 1)
    lowerNode.position = SCNVector3(0, -0.92, -0.02)
    shellNode.addChildNode(lowerNode)
  }

  private func buildSeams() {
    for (firstId, secondId) in seamPairs {
      guard
        let firstTemplate = regionTemplates[firstId],
        let secondTemplate = regionTemplates[secondId]
      else {
        continue
      }

      let seam = cylinderNode(
        from: firstTemplate.position,
        to: secondTemplate.position,
        radius: 0.014,
        color: palette.outline.withAlphaComponent(0.24),
        emission: palette.outline.withAlphaComponent(0.18),
        transparency: 0.22
      )
      seam.renderingOrder = 4
      seamsNode.addChildNode(seam)
    }
  }

  private func buildRegions() {
    regionRecords.enumerated().forEach { index, record in
      guard let template = regionTemplates[record.id] else {
        return
      }

      let geometry = SCNBox(
        width: 0.82,
        height: 0.82,
        length: 0.82,
        chamferRadius: 0.02
      )
      geometry.widthSegmentCount = 1
      geometry.heightSegmentCount = 1
      geometry.lengthSegmentCount = 1

      let node = SCNNode(geometry: geometry)
      node.name = "mind-region:\(record.id)"
      node.position = template.position
      node.scale = template.scale
      node.eulerAngles = template.euler
      node.opacity = reduceMotionEnabled ? regionOpacity(for: record) : 0
      node.geometry?.materials = [material(for: record, selected: false)]

      let outlineBox = SCNBox(
        width: 0.86,
        height: 0.86,
        length: 0.86,
        chamferRadius: 0.02
      )
      outlineBox.materials = [
        material(
          color: palette.outline.withAlphaComponent(0.16),
          emission: palette.outline.withAlphaComponent(0.18),
          transparency: 0.12
        ),
      ]
      let outlineNode = SCNNode(geometry: outlineBox)
      outlineNode.scale = SCNVector3(1.01, 1.01, 1.01)
      node.addChildNode(outlineNode)

      regionsNode.addChildNode(node)
      regionNodes[record.id] = node

      if !reduceMotionEnabled {
        let delay = Double(index) * 0.05
        let wait = SCNAction.wait(duration: delay)
        let fadeIn = SCNAction.fadeOpacity(to: regionOpacity(for: record), duration: 0.28)
        node.runAction(.sequence([wait, fadeIn]))
      }

      if record.isStrongest && !reduceMotionEnabled {
        let pulseUp = SCNAction.scale(to: 1.03, duration: 1.4)
        let pulseDown = SCNAction.scale(to: 1.0, duration: 1.4)
        pulseUp.timingMode = .easeInEaseOut
        pulseDown.timingMode = .easeInEaseOut
        node.runAction(.repeatForever(.sequence([pulseUp, pulseDown])), forKey: "pulse")
      }
    }
  }

  private func regionOpacity(for record: MindMapRegionRecord) -> CGFloat {
    CGFloat(min(0.96, max(0.28, 0.24 + record.signalScore * 0.72)))
  }

  private func colorForRegion(_ record: MindMapRegionRecord, selected: Bool) -> UIColor {
    if selected {
      return palette.selectedNode
    }

    return blendColor(
      from: palette.node,
      to: palette.nodeHot,
      progress: CGFloat(record.signalScore)
    )
  }

  private func material(for record: MindMapRegionRecord, selected: Bool) -> SCNMaterial {
    let baseColor = colorForRegion(record, selected: selected)
    let opacity = regionOpacity(for: record)
    let emissionStrength: CGFloat = selected ? 0.84 : (record.isStrongest ? 0.66 : 0.42)

    return material(
      color: baseColor.withAlphaComponent(opacity),
      emission: baseColor.withAlphaComponent(emissionStrength),
      transparency: opacity
    )
  }

  private func updateSelectionStyles(animated: Bool) {
    let selectedId = selectedRegionId as String?

    SCNTransaction.begin()
    SCNTransaction.animationDuration = animated ? 0.2 : 0
    SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeOut)

    for record in regionRecords {
      guard let node = regionNodes[record.id] else {
        continue
      }

      let selected = record.id == selectedId
      let targetScale = selected ? templateScale(for: record.id) * 1.04 : templateScale(for: record.id)
      node.geometry?.materials = [material(for: record, selected: selected)]
      node.scale = targetScale
    }

    SCNTransaction.commit()
  }

  private func templateScale(for regionId: String) -> SCNVector3 {
    regionTemplates[regionId]?.scale ?? SCNVector3(1, 1, 1)
  }

  private func applyTheme() {
    backgroundColor = palette.background
    sceneView.backgroundColor = palette.background
    scene.background.contents = palette.background
  }

  private func updateCameraPosition() {
    cameraNode.position = SCNVector3(0, 0.12, cameraDistance)
    cameraNode.look(at: SCNVector3(0, 0.02, 0))
  }

  private func resetCamera(animated: Bool) {
    cameraDistance = 4.9
    gestureStartCameraDistance = cameraDistance
    rotationYaw = -0.56
    rotationPitch = 0.08

    SCNTransaction.begin()
    SCNTransaction.animationDuration = animated && !reduceMotionEnabled ? 0.28 : 0
    SCNTransaction.animationTimingFunction = CAMediaTimingFunction(name: .easeOut)
    updateCameraPosition()
    updateContentRotation()
    SCNTransaction.commit()
  }

  private func updateContentRotation() {
    contentRoot.eulerAngles = SCNVector3(rotationPitch, rotationYaw, 0)
  }

  @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
    let translation = gesture.translation(in: sceneView)

    if gesture.state == .began {
      previousPanTranslation = translation
      return
    }

    let deltaX = Float(translation.x - previousPanTranslation.x)
    let deltaY = Float(translation.y - previousPanTranslation.y)
    previousPanTranslation = translation
    rotationYaw += deltaX * 0.0076
    rotationPitch = min(0.42, max(-0.48, rotationPitch + deltaY * 0.0058))
    updateContentRotation()
  }

  @objc private func handlePinch(_ gesture: UIPinchGestureRecognizer) {
    if gesture.state == .began {
      gestureStartCameraDistance = cameraDistance
    }

    let nextDistance = gestureStartCameraDistance / Float(max(gesture.scale, 0.22))
    cameraDistance = min(7.6, max(3.1, nextDistance))
    updateCameraPosition()
  }

  @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
    let location = gesture.location(in: sceneView)
    let hitResults = sceneView.hitTest(location, options: [
      SCNHitTestOption.boundingBoxOnly: false,
      SCNHitTestOption.searchMode: SCNHitTestSearchMode.closest.rawValue,
    ])

    for result in hitResults {
      var currentNode: SCNNode? = result.node

      while let node = currentNode {
        if let name = node.name, name.hasPrefix("mind-region:") {
          let regionId = String(name.dropFirst("mind-region:".count))
          onRegionPress?(["regionId": regionId])
          return
        }

        currentNode = node.parent
      }
    }
  }

  func gestureRecognizer(
    _ gestureRecognizer: UIGestureRecognizer,
    shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer
  ) -> Bool {
    true
  }

  private func material(
    color: UIColor,
    emission: UIColor,
    transparency: CGFloat
  ) -> SCNMaterial {
    let material = SCNMaterial()
    material.diffuse.contents = color
    material.emission.contents = emission
    material.transparency = transparency
    material.lightingModel = .constant
    material.isDoubleSided = true
    material.writesToDepthBuffer = transparency > 0.72
    return material
  }

  private func cylinderNode(
    from startPoint: SCNVector3,
    to endPoint: SCNVector3,
    radius: CGFloat,
    color: UIColor,
    emission: UIColor,
    transparency: CGFloat
  ) -> SCNNode {
    let delta = endPoint - startPoint
    let length = max(delta.length, 0.001)
    let cylinder = SCNCylinder(radius: radius, height: CGFloat(length))
    cylinder.radialSegmentCount = 6
    cylinder.materials = [
      material(color: color, emission: emission, transparency: transparency),
    ]

    let node = SCNNode(geometry: cylinder)
    node.position = (startPoint + endPoint) * 0.5

    if length > 0.001 {
      node.simdOrientation = simd_quatf(
        from: SIMD3<Float>(0, 1, 0),
        to: delta.normalized.simdVector
      )
    }

    return node
  }

  private func blendColor(from: UIColor, to: UIColor, progress: CGFloat) -> UIColor {
    let clamped = min(1, max(0, progress))
    var startRed: CGFloat = 0
    var startGreen: CGFloat = 0
    var startBlue: CGFloat = 0
    var startAlpha: CGFloat = 0
    var endRed: CGFloat = 0
    var endGreen: CGFloat = 0
    var endBlue: CGFloat = 0
    var endAlpha: CGFloat = 0

    from.getRed(&startRed, green: &startGreen, blue: &startBlue, alpha: &startAlpha)
    to.getRed(&endRed, green: &endGreen, blue: &endBlue, alpha: &endAlpha)

    return UIColor(
      red: startRed + (endRed - startRed) * clamped,
      green: startGreen + (endGreen - startGreen) * clamped,
      blue: startBlue + (endBlue - startBlue) * clamped,
      alpha: startAlpha + (endAlpha - startAlpha) * clamped
    )
  }
}

@objc(JournalMindMapViewManager)
class JournalMindMapViewManager: RCTViewManager {
  override static func requiresMainQueueSetup() -> Bool {
    true
  }

  override func view() -> UIView! {
    JournalMindMapView()
  }
}

private func dictionary(from value: Any?) -> [String: Any]? {
  if let dictionary = value as? [String: Any] {
    return dictionary
  }

  if let dictionary = value as? NSDictionary {
    return dictionary as? [String: Any]
  }

  return nil
}

private func floatValue(_ value: Any?) -> Float? {
  if let number = value as? NSNumber {
    return number.floatValue
  }

  if let double = value as? Double {
    return Float(double)
  }

  if let float = value as? Float {
    return float
  }

  if let string = value as? String {
    return Float(string)
  }

  return nil
}

private extension SCNVector3 {
  static func +(left: SCNVector3, right: SCNVector3) -> SCNVector3 {
    SCNVector3(left.x + right.x, left.y + right.y, left.z + right.z)
  }

  static func -(left: SCNVector3, right: SCNVector3) -> SCNVector3 {
    SCNVector3(left.x - right.x, left.y - right.y, left.z - right.z)
  }

  static func *(left: SCNVector3, right: Float) -> SCNVector3 {
    SCNVector3(left.x * right, left.y * right, left.z * right)
  }

  var length: Float {
    sqrt(x * x + y * y + z * z)
  }

  var normalized: SCNVector3 {
    let vectorLength = max(length, 0.0001)
    return SCNVector3(x / vectorLength, y / vectorLength, z / vectorLength)
  }

  var simdVector: SIMD3<Float> {
    SIMD3<Float>(x, y, z)
  }
}

private extension UIColor {
  static func mindMapHex(_ hex: String, alpha: CGFloat = 1) -> UIColor {
    var normalizedHex = hex.trimmingCharacters(in: .whitespacesAndNewlines)
    normalizedHex = normalizedHex.replacingOccurrences(of: "#", with: "")

    guard normalizedHex.count == 6 else {
      return UIColor(white: 1, alpha: alpha)
    }

    var rgbValue: UInt64 = 0
    Scanner(string: normalizedHex).scanHexInt64(&rgbValue)

    return UIColor(
      red: CGFloat((rgbValue & 0xFF0000) >> 16) / 255,
      green: CGFloat((rgbValue & 0x00FF00) >> 8) / 255,
      blue: CGFloat(rgbValue & 0x0000FF) / 255,
      alpha: alpha
    )
  }
}
